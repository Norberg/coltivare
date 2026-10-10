import { isSeedOnlyWorkspace, seedDefaultPlants } from "./defaultPlants";
import type { Repository } from "./repository";
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

// Pure workspace operations. The cloud adapter saves the resulting state atomically.
export class WorkspaceState implements Repository {
  private records: RecordData[] = [];
  private histories = new Map<string, History>();
  private listeners = new Set<() => void>();
  constructor(snapshot?: Snapshot) {
    if (snapshot) {
      const parsed = structuredClone(parseSnapshot(snapshot));
      this.records = parsed.records;
      this.histories = new Map(parsed.histories?.map((h) => [h.id, h]));
    }
  }
  async list() {
    if (!this.records.length) {
      const id = crypto.randomUUID();
      this.records = [
        makeRecord("workspace", id, { id, name: "Min arbetsyta", revision: 1 }),
      ];
    }
    this.records = seedDefaultPlants(this.records).records;
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
      const target = c.after || c.before;
      if (!target) throw new DomainError("validation", "Tom ändring");
      if (
        c.before &&
        c.after &&
        (c.before.id !== c.after.id ||
          c.before.kind !== c.after.kind ||
          c.before.workspaceId !== c.after.workspaceId)
      )
        throw new DomainError(
          "validation",
          "En uppdatering får inte byta identitet, typ eller arbetsyta.",
        );
      const before = candidate.get(target.id);
      if ((before?.revision || 0) !== (c.before?.revision || 0))
        throw new DomainError("conflict", "Revisionskonflikt");
      if (c.after) {
        const after = {
          ...structuredClone(c.after),
          revision: (before?.revision || 0) + 1,
          updatedAt: new Date().toISOString(),
        };
        candidate.set(after.id, after);
        saved.push({ before, after });
      } else {
        candidate.delete(target.id);
        saved.push({ before });
      }
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
      const target = c.after || c.before;
      if (!target) throw new DomainError("validation", "Tom historikändring");
      const before = candidate.get(target.id);
      if (
        (c.after && (!before || content(before) !== content(c.after))) ||
        (!c.after && before)
      )
        throw new DomainError("conflict", "Historikkonflikt");
      if (c.before) {
        const after = {
          ...structuredClone(c.before),
          revision: Math.max(before?.revision || 0, c.before.revision) + 1,
          updatedAt: new Date().toISOString(),
        };
        candidate.set(after.id, after);
        inverse.push({ before, after });
      } else {
        candidate.delete(target.id);
        inverse.push({ before });
      }
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
  async import(value: unknown, options: { replaceWorkspace?: boolean } = {}) {
    const snapshot = structuredClone(parseSnapshot(value));
    const all = this.records;
    let records = snapshot.records;
    if (snapshot.exportKind === "workspace") {
      if (
        !options.replaceWorkspace &&
        all.some((r) => r.kind !== "workspace") &&
        !(isSeedOnlyWorkspace(all) && this.histories.size === 0)
      )
        throw new DomainError(
          "validation",
          "Återställning kräver en tom arbetsyta. Importera en trädgård som kopia i stället.",
        );
    } else {
      const workspace = all.find((r) => r.kind === "workspace")!;
      const defaults = new Map(
        all
          .filter((r) => r.kind === "plant" && r.defaultPlantKey)
          .map((r) => [r.defaultPlantKey!, r.id]),
      );
      const ids = new Map(
        records.map((r) => [
          r.id,
          r.kind === "workspace"
            ? workspace.id
            : r.kind === "plant" &&
                r.defaultPlantKey &&
                defaults.has(r.defaultPlantKey)
              ? defaults.get(r.defaultPlantKey)!
              : crypto.randomUUID(),
        ]),
      );
      records = records
        .filter(
          (r) =>
            r.kind !== "workspace" &&
            !(
              r.kind === "plant" &&
              r.defaultPlantKey &&
              defaults.has(r.defaultPlantKey)
            ),
        )
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
          if (result.additionalPlants)
            result.additionalPlants = result.additionalPlants.map((plant) => ({
              ...plant,
              id: ids.get(plant.id)!,
              workspaceId: workspace.id,
            }));
          if (result.cellPlantIds)
            result.cellPlantIds = result.cellPlantIds.map((id) =>
              id ? ids.get(id)! : null,
            );
          return result;
        });
    }
    const next =
      snapshot.exportKind === "workspace" ? records : [...all, ...records];
    validateRecords(next);
    this.records = next;
    if (snapshot.exportKind === "workspace")
      this.histories = new Map(snapshot.histories?.map((h) => [h.id, h]));
    this.listeners.forEach((f) => f());
  }
}
