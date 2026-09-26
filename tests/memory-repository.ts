import type { Repository } from "../src/repository";
import {
  DomainError,
  makeRecord,
  parseSnapshot,
  validateRecords,
  type Change,
  type History,
  type RecordData,
  type Snapshot,
} from "../src/domain";

// Deliberately separate test adapter. No IndexedDB or production adapter imports.
export class MemoryRepository implements Repository {
  private records: RecordData[] = [];
  private histories = new Map<string, History>();
  private listeners = new Set<() => void>();
  async list() {
    if (!this.records.length) {
      const id = crypto.randomUUID();
      this.records = [
        makeRecord("workspace", id, { id, name: "Testarbetsyta", revision: 1 }),
      ];
    }
    return structuredClone(this.records);
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async close() {}
  async commit(changes: Change[], gardenId?: string) {
    const candidate = new Map(
        this.records.map((r) => [r.id, structuredClone(r)]),
      ),
      saved: Change[] = [];
    for (const c of changes) {
      const before = candidate.get(c.after.id);
      if ((before?.revision || 0) !== (c.before?.revision || 0))
        throw new DomainError("conflict", "Revisionskonflikt");
      const after = {
        ...structuredClone(c.after),
        revision: (before?.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      candidate.set(after.id, after);
      saved.push({ before, after });
    }
    validateRecords([...candidate.values()]);
    const history = gardenId ? await this.history(gardenId) : undefined;
    this.records = [...candidate.values()];
    if (history) {
      history.undo.push(saved);
      history.undo = history.undo.slice(-50);
      history.redo = [];
      this.histories.set(history.id, history);
    }
    this.listeners.forEach((f) => f());
  }
  async history(id: string) {
    return structuredClone(
      this.histories.get(id) || { id, undo: [], redo: [] },
    );
  }
  async travel(id: string, direction: "undo" | "redo") {
    const h = await this.history(id),
      command = h[direction].pop();
    if (!command) return;
    const candidate = new Map(
        this.records.map((r) => [r.id, structuredClone(r)]),
      ),
      inverse: Change[] = [];
    const content = (r: RecordData) =>
      JSON.stringify({ ...r, revision: 0, updatedAt: "" });
    for (const c of [...command].reverse()) {
      const before = candidate.get(c.after.id)!;
      if (content(before) !== content(c.after))
        throw new DomainError("conflict", "Historikkonflikt");
      const after = {
        ...(c.before || { ...before, archived: true }),
        revision: before.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      candidate.set(after.id, after);
      inverse.push({ before, after });
    }
    validateRecords([...candidate.values()]);
    h[direction === "undo" ? "redo" : "undo"].push(inverse);
    this.records = [...candidate.values()];
    this.histories.set(id, h);
    this.listeners.forEach((f) => f());
  }
  async export(gardenId?: string): Promise<Snapshot> {
    return structuredClone({
      schemaVersion: 1,
      exportKind: gardenId ? "garden" : "workspace",
      exportedAt: new Date().toISOString(),
      records: this.records.filter(
        (r) =>
          !gardenId ||
          r.kind === "workspace" ||
          r.kind === "plant" ||
          r.id === gardenId ||
          r.gardenId === gardenId,
      ),
      ...(gardenId ? {} : { histories: [...this.histories.values()] }),
    });
  }
  async import(value: unknown) {
    const s = structuredClone(parseSnapshot(value));
    let records = s.records;
    if (s.exportKind === "workspace") {
      if (this.records.some((r) => r.kind !== "workspace"))
        throw new DomainError("validation", "Arbetsytan är inte tom.");
    } else {
      const workspace = this.records.find((r) => r.kind === "workspace")!;
      const ids = new Map(
        records.map((r) => [
          r.id,
          r.kind === "workspace" ? workspace.id : crypto.randomUUID(),
        ]),
      );
      records = records
        .filter((r) => r.kind !== "workspace")
        .map((r) => {
          const next = {
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
            if (r[key]) next[key] = ids.get(r[key]!);
          if (next.snapshot)
            next.snapshot = {
              ...next.snapshot,
              id: ids.get(next.snapshot.id)!,
              workspaceId: workspace.id,
            };
          if (next.additionalPlants)
            next.additionalPlants = next.additionalPlants.map((plant) => ({
              ...plant,
              id: ids.get(plant.id)!,
              workspaceId: workspace.id,
            }));
          return next;
        });
      records = [...this.records, ...records];
    }
    validateRecords(records);
    this.records = records;
    if (s.exportKind === "workspace")
      this.histories = new Map(s.histories?.map((h) => [h.id, h]));
    this.listeners.forEach((f) => f());
  }
}
