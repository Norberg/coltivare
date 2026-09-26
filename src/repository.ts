import { openDB, type IDBPDatabase } from "idb";
import {
  DomainError,
  makeRecord,
  parseSnapshot,
  validateRecords,
  type Change,
  type History,
  type RecordData,
  type Snapshot,
} from "./domain";
export interface Repository {
  list(): Promise<RecordData[]>;
  commit(changes: Change[], gardenId?: string): Promise<void>;
  travel(gardenId: string, direction: "undo" | "redo"): Promise<void>;
  history(gardenId: string): Promise<History>;
  export(gardenId?: string): Promise<Snapshot>;
  import(value: unknown): Promise<void>;
  subscribe(listener: () => void): () => void;
  close(): Promise<void>;
}
function storageError(error: unknown): Error {
  if (error instanceof DomainError) return error;
  const e = error as Error;
  return new DomainError(
    e.name === "QuotaExceededError"
      ? "quota"
      : e.name === "VersionError"
        ? "version"
        : "unavailable",
    e.name === "QuotaExceededError"
      ? "Lagringsutrymmet är fullt. Inget sparades. Exportera en säkerhetskopia."
      : e.name === "VersionError"
        ? "Databasen kommer från en nyare appversion. Uppdatera appen."
        : "Lokal lagring är otillgänglig eller transaktionen avbröts. Inget sparades. " +
          e.message,
  );
}
export class IndexedRepository implements Repository {
  private db: Promise<IDBPDatabase>;
  private listeners = new Set<() => void>();
  private channel?: BroadcastChannel;
  private connectionError?: DomainError;
  constructor(name = "odlingskartan") {
    this.db = new Promise<IDBPDatabase>((resolve, reject) => {
      let blocked = false;
      void openDB(name, 2, {
        upgrade(db, old, _next, tx) {
          void tx.done.catch(() => {});
          try {
            if (old < 1) {
              const store = db.createObjectStore("records", { keyPath: "id" });
              store.createIndex("kind", "kind");
              store.createIndex("gardenId", "gardenId");
              store.createIndex("workspaceId", "workspaceId");
            }
            if (old < 2) {
              db.createObjectStore("history", { keyPath: "id" });
              tx.objectStore("records").createIndex("plantingId", "plantingId");
            }
          } catch (error) {
            try {
              tx.abort();
            } catch {
              /* An injected or native failure may already have aborted. */
            }
            reject(storageError(error));
          }
        },
        blocked: () => {
          blocked = true;
          reject(
            new DomainError(
              "unavailable",
              "En äldre flik blockerar databasuppgraderingen. Stäng övriga flikar för appen och ladda om. Inga data har raderats.",
            ),
          );
        },
        blocking: () => {
          this.connectionError = new DomainError(
            "version",
            "En annan flik uppgraderar databasen. Ladda om den här fliken innan du fortsätter.",
          );
          void this.db.then((db) => db.close());
          this.emit();
        },
      }).then(
        (db) => {
          if (blocked) db.close();
          else resolve(db);
        },
        (e) => reject(storageError(e)),
      );
    });
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(name);
      this.channel.onmessage = () => this.emit();
    }
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
  private async connection() {
    if (this.connectionError) throw this.connectionError;
    return this.db;
  }
  private notify() {
    this.emit();
    this.channel?.postMessage("commit");
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async close() {
    this.channel?.close();
    (await this.db).close();
  }
  async list() {
    try {
      const db = await this.connection(),
        tx = db.transaction("records", "readwrite"),
        store = tx.objectStore("records");
      let all: RecordData[] = await store.getAll();
      if (!all.length) {
        const id = crypto.randomUUID();
        const workspace = makeRecord("workspace", id, {
          id,
          name: "Min arbetsyta",
          revision: 1,
        });
        await store.add(workspace);
        all = [workspace];
      }
      await tx.done;
      return all;
    } catch (e) {
      throw storageError(e);
    }
  }
  async commit(changes: Change[], gardenId?: string) {
    const db = await this.connection(),
      tx = db.transaction(["records", "history"], "readwrite");
    try {
      const store = tx.objectStore("records");
      const all: RecordData[] = await store.getAll();
      const map = new Map(all.map((r) => [r.id, r]));
      const saved: Change[] = [];
      for (const change of changes) {
        if (
          change.before &&
          (change.before.id !== change.after.id ||
            change.before.kind !== change.after.kind ||
            change.before.workspaceId !== change.after.workspaceId)
        )
          throw new DomainError(
            "validation",
            "En uppdatering får inte byta identitet, typ eller arbetsyta.",
          );
        const current = map.get(change.after.id);
        if ((current?.revision ?? 0) !== (change.before?.revision ?? 0))
          throw new DomainError(
            "conflict",
            `Ändringen sparades inte. En annan flik har redan sparat version ${current?.revision ?? 0} (${current?.updatedAt ?? ""}). Dina formulärvärden finns kvar; läs den senaste versionen innan du försöker igen.`,
          );
        const after = {
          ...change.after,
          revision: (current?.revision ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        };
        map.set(after.id, after);
        saved.push({ before: current, after });
      }
      validateRecords([...map.values()]);
      for (const c of saved) await store.put(c.after);
      if (gardenId) {
        const h: History = (await tx.objectStore("history").get(gardenId)) || {
          id: gardenId,
          undo: [],
          redo: [],
        };
        h.undo = [...h.undo, saved].slice(-50);
        h.redo = [];
        await tx.objectStore("history").put(h);
      }
      await tx.done;
      this.notify();
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* Already aborted. */
      }
      await tx.done.catch(() => {});
      throw storageError(e);
    }
  }
  async history(gardenId: string): Promise<History> {
    return (
      (await (await this.connection()).get("history", gardenId)) || {
        id: gardenId,
        undo: [],
        redo: [],
      }
    );
  }
  async travel(gardenId: string, direction: "undo" | "redo") {
    const db = await this.connection(),
      tx = db.transaction(["records", "history"], "readwrite");
    try {
      const h: History = (await tx.objectStore("history").get(gardenId)) || {
        id: gardenId,
        undo: [],
        redo: [],
      };
      const command = h[direction].pop();
      if (!command) {
        await tx.done;
        return;
      }
      const store = tx.objectStore("records"),
        all: RecordData[] = await store.getAll(),
        map = new Map(all.map((r) => [r.id, r]));
      const inverse: Change[] = [];
      for (const c of [...command].reverse()) {
        const current = map.get(c.after.id)!;
        // Revisions can advance through undo/redo, but unrelated edits must not be overwritten.
        const content = (r: RecordData) =>
          JSON.stringify({ ...r, revision: 0, updatedAt: "" });
        if (content(current) !== content(c.after))
          throw new DomainError(
            "conflict",
            "Objektet har ändrats sedan kartoperationen. Ångra kan inte skriva över den versionen.",
          );
        const after = {
          ...(c.before || { ...current, archived: true }),
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        map.set(after.id, after);
        inverse.push({ before: current, after });
      }
      validateRecords([...map.values()]);
      for (const c of inverse) await store.put(c.after);
      h[direction === "undo" ? "redo" : "undo"].push(inverse);
      await tx.objectStore("history").put(h);
      await tx.done;
      this.notify();
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* Already aborted. */
      }
      await tx.done.catch(() => {});
      throw storageError(e);
    }
  }
  async export(gardenId?: string): Promise<Snapshot> {
    const db = await this.connection(),
      tx = db.transaction(["records", "history"], "readonly");
    const all: RecordData[] = await tx.objectStore("records").getAll();
    const histories: History[] = await tx.objectStore("history").getAll();
    await tx.done;
    return {
      schemaVersion: 1,
      exportKind: gardenId ? "garden" : "workspace",
      exportedAt: new Date().toISOString(),
      ...(gardenId ? {} : { histories }),
      records: all.filter(
        (r) =>
          !gardenId ||
          r.kind === "workspace" ||
          r.kind === "plant" ||
          r.id === gardenId ||
          r.gardenId === gardenId,
      ),
    };
  }
  async import(value: unknown) {
    const snapshot = parseSnapshot(value),
      db = await this.connection(),
      tx = db.transaction(["records", "history"], "readwrite");
    try {
      const store = tx.objectStore("records"),
        all: RecordData[] = await store.getAll();
      let records = snapshot.records;
      if (snapshot.exportKind === "workspace") {
        if (all.some((r) => r.kind !== "workspace"))
          throw new DomainError(
            "validation",
            "Återställning kräver en tom arbetsyta. Importera en trädgård som kopia i stället.",
          );
        await store.clear();
        await tx.objectStore("history").clear();
      } else {
        const workspace = all.find((r) => r.kind === "workspace")!;
        const ids = new Map(
          records.map((r) => [
            r.id,
            r.kind === "workspace" ? workspace.id : crypto.randomUUID(),
          ]),
        );
        records = records
          .filter((r) => r.kind !== "workspace")
          .map((r) => {
            const result = {
              ...r,
              id: ids.get(r.id)!,
              workspaceId: workspace.id,
              revision: 1,
            };
            for (const key of [
              "gardenId",
              "plantId",
              "plantingId",
              "objectId",
              "targetId",
            ] as const)
              if (r[key]) result[key] = ids.get(r[key]!);
            if (result.snapshot)
              result.snapshot = {
                ...result.snapshot,
                id: ids.get(result.snapshot.id) || result.snapshot.id,
                workspaceId: workspace.id,
              };
            return result;
          });
      }
      validateRecords(
        snapshot.exportKind === "workspace" ? records : [...all, ...records],
      );
      for (const r of records) await store.add(r);
      if (snapshot.exportKind === "workspace")
        for (const history of snapshot.histories || [])
          await tx.objectStore("history").add(history);
      await tx.done;
      this.notify();
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* Already aborted. */
      }
      await tx.done.catch(() => {});
      throw storageError(e);
    }
  }
}
