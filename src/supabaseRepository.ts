import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repository } from "./repository";
import { DomainError, type Change, type Snapshot } from "./domain";
import { WorkspaceState } from "./workspaceState";

export interface CloudState {
  version: number;
  records: Snapshot["records"];
  histories: NonNullable<Snapshot["histories"]>;
}
export interface CloudGateway {
  read(): Promise<CloudState>;
  version(): Promise<number>;
  write(expectedVersion: number, snapshot: Snapshot): Promise<number>;
}

function cloudError(error: { code?: string; message: string }): DomainError {
  if (error.code === "40001")
    return new DomainError(
      "conflict",
      "En annan enhet har ändrat arbetsytan. Ladda den senaste versionen innan du försöker igen.",
    );
  if (error.code === "PGRST202" || error.code === "42P01")
    return new DomainError(
      "unavailable",
      "Molnlagringen är inte aktiverad ännu. Använd lokal lagring tills den är färdigkonfigurerad.",
    );
  return new DomainError(
    "unavailable",
    "Molnlagringen kunde inte nås. Kontrollera anslutningen och att du är inloggad. Om anslutningen bröts under sparandet, ladda om och kontrollera resultatet innan du försöker igen. " +
      error.message,
  );
}

export function supabaseGateway(client: SupabaseClient): CloudGateway {
  return {
    async read() {
      const { data, error } = await client.rpc("coltivare_read_workspace");
      if (error) throw cloudError(error);
      if (
        !data ||
        !Number.isSafeInteger(data.version) ||
        !Array.isArray(data.records) ||
        !Array.isArray(data.histories)
      )
        throw new DomainError(
          "version",
          "Molndatabasen har ett oväntat format.",
        );
      return data as CloudState;
    },
    async version() {
      // Existing RLS restricts this small SELECT to the signed-in owner's row.
      const { data, error } = await client
        .from("coltivare_workspaces")
        .select("version")
        .maybeSingle();
      if (error) throw cloudError(error);
      const version = data?.version ?? 0;
      if (!Number.isSafeInteger(version) || version < 0)
        throw new DomainError(
          "version",
          "Molndatabasen har ett oväntat format.",
        );
      return version;
    },
    async write(expectedVersion, snapshot) {
      const { data, error } = await client.rpc("coltivare_save_workspace", {
        expected_version: expectedVersion,
        next_records: snapshot.records,
        next_histories: snapshot.histories || [],
      });
      if (error) throw cloudError(error);
      if (!Number.isSafeInteger(data) || data !== expectedVersion + 1)
        throw new DomainError(
          "version",
          "Sparandet kunde inte bekräftas. Ladda om och kontrollera resultatet.",
        );
      return data as number;
    },
  };
}

/** Session-only cache. Server CAS still protects every write; nothing is queued offline. */
export class SupabaseRepository implements Repository {
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setInterval>;
  private cached?: CloudState;
  private checkedAt = 0;
  private queue: Promise<void> = Promise.resolve();
  constructor(private gateway: CloudGateway) {}
  private emit = () => this.listeners.forEach((listener) => listener());
  private refresh = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    )
      return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    this.emit();
  };
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.timer = setInterval(this.refresh, 60000);
      if (typeof window !== "undefined") {
        window.addEventListener("focus", this.refresh);
        window.addEventListener("online", this.refresh);
        document.addEventListener("visibilitychange", this.refresh);
      }
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  }
  private stop() {
    clearInterval(this.timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.refresh);
      window.removeEventListener("online", this.refresh);
      document.removeEventListener("visibilitychange", this.refresh);
    }
  }
  async close() {
    this.stop();
    this.listeners.clear();
    this.cached = undefined;
  }
  // Serialize operations so a late read cannot replace a newly saved cache entry.
  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  private async load(forceCheck = false) {
    if (!this.cached || forceCheck || Date.now() - this.checkedAt >= 2000) {
      if (
        !this.cached ||
        (await this.gateway.version()) !== this.cached.version
      )
        this.cached = await this.gateway.read();
      this.checkedAt = Date.now();
    }
    const cloud = this.cached;
    const state = new WorkspaceState(
      cloud.records.length
        ? {
            schemaVersion: 1,
            exportKind: "workspace",
            exportedAt: new Date().toISOString(),
            records: cloud.records,
            histories: cloud.histories,
          }
        : undefined,
    );
    return { cloud, state };
  }
  private async persist(version: number, state: WorkspaceState) {
    const snapshot = await state.export();
    try {
      const nextVersion = await this.gateway.write(version, snapshot);
      this.cached = {
        version: nextVersion,
        records: snapshot.records,
        histories: snapshot.histories || [],
      };
      this.checkedAt = Date.now();
    } catch (error) {
      // A lost response may mean the server committed; never reuse the pre-write cache.
      this.cached = undefined;
      throw error;
    }
  }
  async list(): Promise<Snapshot["records"]> {
    return this.run(async () => {
      for (;;) {
        const { cloud, state } = await this.load();
        const records = await state.list();
        if (JSON.stringify(records) !== JSON.stringify(cloud.records)) {
          try {
            await this.persist(cloud.version, state);
          } catch (error) {
            // Two devices may initialize the same empty account at once.
            if (error instanceof DomainError && error.code === "conflict")
              continue;
            throw error;
          }
        }
        return records;
      }
    });
  }
  private async mutate(operation: (state: WorkspaceState) => Promise<void>) {
    return this.run(async () => {
      const { cloud, state } = await this.load(true);
      await state.list();
      await operation(state);
      await this.persist(cloud.version, state);
      this.emit();
    });
  }
  commit(changes: Change[], gardenId?: string) {
    return this.mutate((state) => state.commit(changes, gardenId));
  }
  travel(gardenId: string, direction: "undo" | "redo") {
    return this.mutate((state) => state.travel(gardenId, direction));
  }
  async history(gardenId: string) {
    return this.run(async () => (await this.load()).state.history(gardenId));
  }
  async export(gardenId?: string) {
    return this.run(async () => (await this.load(true)).state.export(gardenId));
  }
  import(value: unknown, options?: { replaceWorkspace?: boolean }) {
    return this.mutate((state) => state.import(value, options));
  }
}
