import { openDB } from "idb";
import { IndexedRepository } from "../src/repository";
import { makeRecord } from "../src/domain";
import { defaultPlantsVersion } from "../src/defaultPlants";
import { plantIcons } from "../src/plantAppearance";

test("a new workspace gets one standard plant per icon, only once", async () => {
  const repository = new IndexedRepository(crypto.randomUUID());
  try {
    const first = await repository.list();
    const workspace = first.find((record) => record.kind === "workspace")!;
    expect(workspace.fields?.defaultPlantsVersion).toBe(defaultPlantsVersion);
    expect(first.filter((record) => record.defaultPlantKey)).toHaveLength(
      Object.keys(plantIcons).length,
    );
    const second = await repository.list();
    expect(second).toHaveLength(first.length);
    expect(second).toEqual(expect.arrayContaining(first));
  } finally {
    await repository.close();
  }
});

test("reading an existing garden never rewrites its records or reclassifies plants", async () => {
  const name = crypto.randomUUID();
  const db = await openDB(name, 2, {
    upgrade(database) {
      const records = database.createObjectStore("records", { keyPath: "id" });
      records.createIndex("kind", "kind");
      records.createIndex("gardenId", "gardenId");
      records.createIndex("workspaceId", "workspaceId");
      records.createIndex("plantingId", "plantingId");
      database.createObjectStore("history", { keyPath: "id" });
    },
  });
  const workspace = makeRecord("workspace", crypto.randomUUID());
  workspace.workspaceId = workspace.id;
  const garden = makeRecord("garden", workspace.id, {
    name: "Befintlig trädgård",
    width: 10,
    height: 10,
  });
  const plant = makeRecord("plant", workspace.id, { name: "Ruccola" });
  const original = [workspace, garden, plant];
  const tx = db.transaction("records", "readwrite");
  for (const record of original) await tx.store.put(record);
  await tx.done;
  db.close();

  const repository = new IndexedRepository(name);
  try {
    const listed = await repository.list();
    expect(listed).toEqual(expect.arrayContaining(original));
    expect(listed).toHaveLength(original.length);
    const after = await openDB(name);
    expect(await after.getAll("records")).toEqual(
      expect.arrayContaining(original),
    );
    after.close();
  } finally {
    await repository.close();
  }
});

test("a full backup can replace an untouched generated catalogue", async () => {
  const repository = new IndexedRepository(crypto.randomUUID());
  try {
    await repository.list();
    const oldWorkspace = makeRecord("workspace", crypto.randomUUID());
    oldWorkspace.workspaceId = oldWorkspace.id;
    const garden = makeRecord("garden", oldWorkspace.id, {
      name: "Återställd trädgård",
      width: 10,
      height: 10,
    });
    await repository.import({
      schemaVersion: 1,
      exportKind: "workspace",
      exportedAt: new Date().toISOString(),
      records: [oldWorkspace, garden],
      histories: [],
    });
    const restored = await repository.list();
    expect(restored).toHaveLength(2);
    expect(restored.find((record) => record.kind === "workspace")?.id).toBe(
      oldWorkspace.id,
    );
    expect(restored.find((record) => record.kind === "garden")?.id).toBe(
      garden.id,
    );
  } finally {
    await repository.close();
  }
});
