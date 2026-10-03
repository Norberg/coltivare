import { openDB } from "idb";
import { IndexedRepository, type Repository } from "../src/repository";
import { makeRecord, type RecordData } from "../src/domain";
import { plantIcons } from "../src/plantAppearance";
let repo: Repository;
beforeEach(() => {
  repo = new IndexedRepository(crypto.randomUUID());
});
afterEach(async () => {
  await repo.close();
});
async function fixture() {
  const [w] = await repo.list();
  const g = makeRecord("garden", w.id, {
    name: "Min trädgård",
    width: 20,
    height: 15,
  });
  const o = makeRecord("object", w.id, {
    name: "Bädd",
    gardenId: g.id,
    geometry: {
      x: 1,
      y: 2,
      width: 4,
      height: 1.2,
      rotation: 0,
      shape: "rectangle",
    },
  });
  const plant = makeRecord("plant", w.id, { name: "Morot, test A" });
  const p = makeRecord("planting", w.id, {
    gardenId: g.id,
    name: "Morötter",
    count: 20,
    plantId: plant.id,
    snapshot: plant,
  });
  const placement = makeRecord("placement", w.id, {
    gardenId: g.id,
    name: p.name,
    plantingId: p.id,
    objectId: o.id,
    geometry: {
      x: 0.2,
      y: 0.2,
      width: 1,
      height: 0.5,
      rotation: 0,
      shape: "rectangle",
    },
    startDate: "2027-04-15",
    endDate: "2027-09-01",
    layer: "actual",
  });
  await repo.commit(
    [g, o, plant, p, placement].map((after) => ({ after })),
    g.id,
  );
  return { w, g, o, plant, p, placement };
}
test("mixed planting snapshots survive edits, undo/redo, garden copy and workspace restore", async () => {
  const { w, g, p } = await fixture();
  const flower = makeRecord("plant", w.id, {
    name: "Blåklint",
    icon: "cornflower",
  });
  const saved = (await repo.list()).find((r) => r.id === p.id)!;
  await repo.commit(
    [
      { after: flower },
      {
        before: saved,
        after: { ...saved, name: "Blomsteräng", additionalPlants: [flower] },
      },
    ],
    g.id,
  );
  await repo.travel(g.id, "undo");
  expect(
    (await repo.list()).find((r) => r.id === p.id)!.additionalPlants,
  ).toBeUndefined();
  await repo.travel(g.id, "redo");
  const liveFlower = (await repo.list()).find((r) => r.id === flower.id)!;
  await repo.commit([
    { before: liveFlower, after: { ...liveFlower, name: "Nytt katalognamn" } },
  ]);
  expect(
    (await repo.list()).find((r) => r.id === p.id)!.additionalPlants![0].name,
  ).toBe("Blåklint");
  const other = new IndexedRepository(crypto.randomUUID());
  try {
    await other.import(await repo.export());
    expect(
      (await other.list()).find((r) => r.id === p.id)!.additionalPlants,
    ).toEqual([flower]);
  } finally {
    await other.close();
  }
  await repo.import(await repo.export(g.id));
  const all = await repo.list();
  const copy = all.find((r) => r.kind === "planting" && r.id !== p.id)!;
  expect(copy.additionalPlants![0].id).not.toBe(flower.id);
  expect(copy.additionalPlants![0].workspaceId).toBe(w.id);
  expect(all.find((r) => r.id === copy.additionalPlants![0].id)!.name).toBe(
    "Nytt katalognamn",
  );
  expect(copy.additionalPlants![0].name).toBe("Blåklint");
});

test("separate records persist and revision conflicts roll back entire commands", async () => {
  const { g, o } = await fixture();
  const saved = (await repo.list()).find((r) => r.id === o.id)!;
  await repo.commit(
    [{ before: saved, after: { ...saved, name: "Vinnande version" } }],
    g.id,
  );
  const extra = makeRecord("plant", saved.workspaceId, {
    name: "Får inte sparas",
  });
  await expect(
    repo.commit(
      [
        { after: extra },
        { before: saved, after: { ...saved, name: "Förlorande version" } },
      ],
      g.id,
    ),
  ).rejects.toMatchObject({ code: "conflict" });
  expect((await repo.list()).find((r) => r.id === o.id)?.name).toBe(
    "Vinnande version",
  );
  expect((await repo.list()).some((r) => r.id === extra.id)).toBe(false);
});
test("physical move is atomic and prevents overlapping periods", async () => {
  const { placement } = await fixture();
  const current = (await repo.list()).find((r) => r.id === placement.id)!;
  const next = makeRecord("placement", current.workspaceId, {
    ...current,
    id: crypto.randomUUID(),
    revision: 0,
    startDate: "2027-06-01",
    geometry: { ...current.geometry!, x: 8 },
  });
  await expect(repo.commit([{ after: next }])).rejects.toMatchObject({
    code: "validation",
  });
  await repo.commit([
    { before: current, after: { ...current, endDate: "2027-06-01" } },
    { after: next },
  ]);
  expect(
    (await repo.list()).filter((r) => r.kind === "placement"),
  ).toHaveLength(2);
});
test("undo/redo persists over reopening and never deletes domain history", async () => {
  const { g, o } = await fixture();
  const original = (await repo.list()).find((r) => r.id === o.id)!;
  for (let i = 0; i < 25; i++) {
    const current = (await repo.list()).find((r) => r.id === o.id)!;
    await repo.commit(
      [
        {
          before: current,
          after: { ...current, geometry: { ...current.geometry!, x: i + 3 } },
        },
      ],
      g.id,
    );
  }
  expect((await repo.history(g.id)).undo.length).toBe(26);
  for (let i = 0; i < 25; i++) await repo.travel(g.id, "undo");
  expect((await repo.list()).find((r) => r.id === o.id)?.geometry).toEqual(
    original.geometry,
  );
  await repo.travel(g.id, "redo");
  expect((await repo.list()).find((r) => r.id === o.id)?.geometry?.x).toBe(3);
});
test("garden import remaps relationships and includes unused plants", async () => {
  const { g, w } = await fixture();
  await repo.commit([
    { after: makeRecord("plant", w.id, { name: "Oanvänd" }) },
  ]);
  const snapshot = await repo.export(g.id);
  await repo.import(snapshot);
  const all = await repo.list();
  expect(all.filter((r) => r.kind === "garden")).toHaveLength(2);
  expect(
    all.filter((r) => r.kind === "plant" && r.name === "Oanvänd"),
  ).toHaveLength(2);
  expect(
    all.filter((r) => r.kind === "plant" && r.defaultPlantKey),
  ).toHaveLength(Object.keys(plantIcons).length);
  const copy = all.find((r) => r.kind === "garden" && r.id !== g.id)!;
  const copiedPlacement = all.find(
    (r) => r.kind === "placement" && r.gardenId === copy.id,
  )!;
  expect(all.find((r) => r.id === copiedPlacement.objectId)?.gardenId).toBe(
    copy.id,
  );
  const before = await repo.list();
  snapshot.records.find((r) => r.kind === "placement")!.objectId =
    crypto.randomUUID();
  await expect(repo.import(snapshot)).rejects.toThrow();
  expect(await repo.list()).toEqual(before);
});
test("workspace restore preserves IDs and rejects nonempty targets", async () => {
  await fixture();
  const snapshot = await repo.export();
  const other = new IndexedRepository(crypto.randomUUID());
  await other.list();
  await other.import(snapshot);
  expect(await other.list()).toEqual(await repo.list());
  await expect(other.import(snapshot)).rejects.toThrow("tom arbetsyta");
  await other.close();
});
test("catalogue edits never mutate snapshots or harvest placement dates", async () => {
  const { plant, p, g, w, placement } = await fixture();
  const before = (await repo.list()).find((r) => r.id === plant.id)!;
  await repo.commit([
    {
      before,
      after: {
        ...before,
        name: "Nytt namn",
        fields: { "Skörd min (dagar)": "50", "Skörd räknas från": "Sådd" },
      },
    },
  ]);
  for (const date of ["2027-06-10", "2027-06-20"])
    await repo.commit([
      {
        after: makeRecord("event", w.id, {
          gardenId: g.id,
          targetId: p.id,
          eventType: "Skörd",
          date,
          quantity: 2,
          unit: "kg",
        }),
      },
    ]);
  const all = await repo.list();
  expect(all.find((r) => r.id === p.id)?.snapshot?.name).toBe(plant.name);
  expect(all.find((r) => r.id === placement.id)?.endDate).toBe("2027-09-01");
});
test("schema 1 upgrade retains records and adds history without deletion", async () => {
  const name = crypto.randomUUID(),
    db = await openDB(name, 1, {
      upgrade(db) {
        const s = db.createObjectStore("records", { keyPath: "id" });
        s.createIndex("kind", "kind");
        s.createIndex("gardenId", "gardenId");
        s.createIndex("workspaceId", "workspaceId");
      },
    });
  const id = crypto.randomUUID(),
    w = makeRecord("workspace", id, {
      id,
      name: "Äldre arbetsyta",
      revision: 1,
    });
  await db.put("records", w);
  db.close();
  const upgraded = new IndexedRepository(name);
  const upgradedRecords = await upgraded.list();
  expect(upgradedRecords.find((record) => record.id === w.id)?.name).toBe(
    w.name,
  );
  expect(
    upgradedRecords.filter((record) => record.defaultPlantKey),
  ).toHaveLength(Object.keys(plantIcons).length);
  expect((await upgraded.history("test")).undo).toEqual([]);
  await upgraded.close();
});
test("unknown newer schema fails without destroying data", async () => {
  const name = crypto.randomUUID(),
    db = await openDB(name, 99, {
      upgrade(db) {
        db.createObjectStore("sentinel");
      },
    });
  await db.put("sentinel", "bevarad", "key");
  db.close();
  const newer = new IndexedRepository(name);
  await expect(newer.list()).rejects.toMatchObject({ code: "version" });
  const read = await openDB(name);
  expect(await read.get("sentinel", "key")).toBe("bevarad");
  read.close();
});
test("invalid cross-garden references roll back", async () => {
  const { w, g, placement } = await fixture();
  const second = makeRecord("garden", w.id, {
    name: "Annan",
    width: 10,
    height: 10,
  });
  await repo.commit([{ after: second }]);
  const current = (await repo.list()).find((r) => r.id === placement.id)!;
  await expect(
    repo.commit(
      [{ before: current, after: { ...current, gardenId: second.id } }],
      g.id,
    ),
  ).rejects.toThrow("annan trädgård");
});
test("reopening preserves saved data and history", async () => {
  const name = crypto.randomUUID();
  await repo.close();
  repo = new IndexedRepository(name);
  const { g } = await fixture();
  const before = await repo.list();
  await repo.close();
  repo = new IndexedRepository(name);
  expect(await repo.list()).toEqual(before);
  expect((await repo.history(g.id)).undo).toHaveLength(1);
});
test("quota failure after the first write rolls back all records and history", async () => {
  const { g, w } = await fixture();
  const before = await repo.list(),
    history = await repo.history(g.id);
  const original = IDBObjectStore.prototype.put;
  let writes = 0;
  const spy = jest
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (++writes === 2)
        throw new DOMException("Injected quota failure", "QuotaExceededError");
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    });
  try {
    await expect(
      repo.commit(
        [
          { after: makeRecord("plant", w.id, { name: "A" }) },
          { after: makeRecord("plant", w.id, { name: "B" }) },
        ],
        g.id,
      ),
    ).rejects.toMatchObject({ code: "quota" });
  } finally {
    spy.mockRestore();
  }
  expect(await repo.list()).toEqual(before);
  expect(await repo.history(g.id)).toEqual(history);
});
test("explicit transaction abort does not leave partial writes", async () => {
  const { g, w } = await fixture();
  const before = await repo.list();
  const original = IDBObjectStore.prototype.put;
  const spy = jest
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const result =
        key === undefined
          ? original.call(this, value)
          : original.call(this, value, key);
      this.transaction.abort();
      return result;
    });
  try {
    await expect(
      repo.commit(
        [{ after: makeRecord("plant", w.id, { name: "Avbruten" }) }],
        g.id,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  } finally {
    spy.mockRestore();
  }
  expect(await repo.list()).toEqual(before);
});
test("a blocked upgrade reports the old tab instead of hanging silently", async () => {
  const name = crypto.randomUUID();
  const old = await openDB(name, 1, {
    upgrade(db) {
      const store = db.createObjectStore("records", { keyPath: "id" });
      store.createIndex("kind", "kind");
      store.createIndex("gardenId", "gardenId");
      store.createIndex("workspaceId", "workspaceId");
    },
  });
  const blocked = new IndexedRepository(name);
  await expect(blocked.list()).rejects.toThrow("äldre flik");
  old.close();
});
test("failed migration preserves the previous version and all records", async () => {
  const name = crypto.randomUUID(),
    old = await openDB(name, 1, {
      upgrade(db) {
        const store = db.createObjectStore("records", { keyPath: "id" });
        store.createIndex("kind", "kind");
        store.createIndex("gardenId", "gardenId");
        store.createIndex("workspaceId", "workspaceId");
      },
    });
  const id = crypto.randomUUID(),
    record = makeRecord("workspace", id, { id, name: "Bevarad", revision: 1 });
  await old.put("records", record);
  old.close();
  const create = IDBDatabase.prototype.createObjectStore;
  const spy = jest
    .spyOn(IDBDatabase.prototype, "createObjectStore")
    .mockImplementation(function (
      this: IDBDatabase,
      storeName: string,
      options?: IDBObjectStoreParameters,
    ) {
      const store = create.call(this, storeName, options);
      if (storeName === "history") store.transaction.abort();
      return store;
    });
  try {
    const failed = new IndexedRepository(name);
    await expect(failed.list()).rejects.toMatchObject({ code: "unavailable" });
  } finally {
    spy.mockRestore();
  }
  const retained = await openDB(name);
  expect(retained.version).toBe(1);
  expect(await retained.get("records", id)).toEqual(record);
  expect(retained.objectStoreNames.contains("history")).toBe(false);
  retained.close();
});
test("workspace backup preserves undo history", async () => {
  const { g } = await fixture();
  const backup = await repo.export();
  const other = new IndexedRepository(crypto.randomUUID());
  await other.list();
  await other.import(backup);
  expect(await other.history(g.id)).toEqual(await repo.history(g.id));
  await other.travel(g.id, "undo");
  expect((await other.list()).find((r) => r.id === g.id)).toBeUndefined();
  const undoneBackup = await other.export();
  const restored = new IndexedRepository(crypto.randomUUID());
  await restored.list();
  await restored.import(undoneBackup);
  await restored.travel(g.id, "redo");
  expect((await restored.list()).find((r) => r.id === g.id)?.name).toBe(
    "Min trädgård",
  );
  await restored.close();
  await other.close();
});
test("legacy archived data is purged while ordinary undo history remains", async () => {
  const name = crypto.randomUUID();
  const initial = new IndexedRepository(name);
  const [workspace] = await initial.list();
  await initial.close();
  const garden = makeRecord("garden", workspace.id, {
    name: "Migrerad trädgård",
    width: 10,
    height: 10,
  });
  const before = makeRecord("object", workspace.id, {
    name: "Före",
    gardenId: garden.id,
    geometry: {
      x: 1,
      y: 1,
      width: 2,
      height: 1,
      rotation: 0,
      shape: "rectangle",
    },
  });
  const after = { ...before, name: "Efter", revision: 1 };
  const removed = makeRecord("plant", workspace.id, { name: "Arkiverad" });
  const removedBed = makeRecord("object", workspace.id, {
    name: "Arkiverad bädd",
    gardenId: garden.id,
    geometry: {
      x: 4,
      y: 5,
      width: 2,
      height: 1,
      rotation: 0,
      shape: "rectangle",
    },
  });
  const activePlant = makeRecord("plant", workspace.id, { name: "Bevarad" });
  const planting = makeRecord("planting", workspace.id, {
    name: "Bevarad plantering",
    gardenId: garden.id,
    plantId: activePlant.id,
    snapshot: activePlant,
    count: 1,
  });
  const placement = makeRecord("placement", workspace.id, {
    name: planting.name,
    gardenId: garden.id,
    plantingId: planting.id,
    objectId: removedBed.id,
    startDate: "2027-01-01",
    layer: "actual",
    geometry: {
      x: 0.5,
      y: 0.5,
      width: 0.5,
      height: 0.5,
      rotation: 0,
      shape: "rectangle",
    },
  });
  const legacy = await openDB(name);
  const tx = legacy.transaction(["records", "history"], "readwrite");
  await tx.objectStore("records").put({ ...workspace, archived: false });
  await tx.objectStore("records").put({ ...garden, archived: false });
  await tx.objectStore("records").put({ ...after, archived: false });
  await tx.objectStore("records").put({ ...removed, archived: true });
  await tx.objectStore("records").put({ ...removedBed, archived: true });
  await tx.objectStore("records").put({ ...activePlant, archived: false });
  await tx.objectStore("records").put({ ...planting, archived: false });
  await tx.objectStore("records").put({ ...placement, archived: false });
  await tx.objectStore("history").put({
    id: garden.id,
    undo: [
      [{ after: { ...removed, archived: true } }],
      [
        {
          before: { ...before, archived: false },
          after: { ...after, archived: false },
        },
      ],
    ],
    redo: [],
  });
  await tx.done;
  legacy.close();

  const migrated = new IndexedRepository(name);
  try {
    const records = await migrated.list();
    expect(records.some((record) => record.id === removed.id)).toBe(false);
    expect(records.some((record) => record.id === removedBed.id)).toBe(false);
    expect(JSON.stringify(records)).not.toContain('"archived"');
    const migratedPlacement = records.find(
      (record) => record.id === placement.id,
    )!;
    expect(migratedPlacement.objectId).toBeUndefined();
    expect(migratedPlacement.geometry).toMatchObject({ x: 4.5, y: 5.5 });
    expect((await migrated.history(garden.id)).undo).toHaveLength(1);
    await migrated.travel(garden.id, "undo");
    expect(
      (await migrated.list()).find((record) => record.id === before.id)?.name,
    ).toBe("Före");
  } finally {
    await migrated.close();
  }
});
// A consumer-side adapter verifies that the port has no IndexedDB-specific arguments.
test("the repository port can be injected without storage-engine types", async () => {
  const data: RecordData[] = [];
  const adapter: Repository = {
    list: async () => data,
    commit: async (changes) => {
      data.push(
        ...changes
          .map((change) => change.after)
          .filter((record): record is RecordData => !!record),
      );
    },
    travel: async () => {},
    history: async (id) => ({ id, undo: [], redo: [] }),
    export: async () => ({
      schemaVersion: 1,
      exportKind: "workspace",
      exportedAt: new Date().toISOString(),
      records: data,
    }),
    import: async () => {},
    subscribe: () => () => {},
    close: async () => {},
  };
  const consume = async (port: Repository) => {
    const plant = makeRecord("plant", "", { name: "Test" });
    await port.commit([{ after: plant }]);
    return port.list();
  };
  expect(await consume(adapter)).toHaveLength(1);
});
