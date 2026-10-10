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
  write(expectedVersion: number, snapshot: Snapshot): Promise<void>;
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
    async write(expectedVersion, snapshot) {
      const { error } = await client.rpc("coltivare_save_workspace", {
        expected_version: expectedVersion,
        next_records: snapshot.records,
        next_histories: snapshot.histories || [],
      });
      if (error) throw cloudError(error);
    },
  };
}

/** Always reads the server before a write. Never queues writes or falls back to local data. */
export class SupabaseRepository implements Repository {
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setInterval>;
  constructor(private gateway: CloudGateway) {}
  private emit = () => this.listeners.forEach((listener) => listener());
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.timer = setInterval(this.emit, 30000);
      if (typeof window !== "undefined")
        window.addEventListener("focus", this.emit);
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  }
  private stop() {
    clearInterval(this.timer);
    if (typeof window !== "undefined")
      window.removeEventListener("focus", this.emit);
  }
  async close() {
    this.stop();
    this.listeners.clear();
  }
  private async load() {
    const cloud = await this.gateway.read();
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
  async list(): Promise<Snapshot["records"]> {
    const { cloud, state } = await this.load();
    const records = await state.list();
    if (JSON.stringify(records) !== JSON.stringify(cloud.records)) {
      try {
        await this.gateway.write(cloud.version, await state.export());
      } catch (error) {
        // Two devices can initialize the same empty account at once. Read the winner.
        if (error instanceof DomainError && error.code === "conflict")
          return this.list();
        throw error;
      }
    }
    return records;
  }
  private async mutate(operation: (state: WorkspaceState) => Promise<void>) {
    const { cloud, state } = await this.load();
    await state.list();
    await operation(state);
    await this.gateway.write(cloud.version, await state.export());
    this.emit();
  }
  commit(changes: Change[], gardenId?: string) {
    return this.mutate((state) => state.commit(changes, gardenId));
  }
  travel(gardenId: string, direction: "undo" | "redo") {
    return this.mutate((state) => state.travel(gardenId, direction));
  }
  async history(gardenId: string) {
    return (await this.load()).state.history(gardenId);
  }
  async export(gardenId?: string) {
    return (await this.load()).state.export(gardenId);
  }
  import(value: unknown, options?: { replaceWorkspace?: boolean }) {
    return this.mutate((state) => state.import(value, options));
  }
}
