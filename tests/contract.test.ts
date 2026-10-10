import { IndexedRepository, type Repository } from "../src/repository";
import { MemoryRepository } from "./memory-repository";
import { makeRecord } from "../src/domain";
import { SupabaseRepository } from "../src/supabaseRepository";
import { TestCloudGateway } from "./cloud-gateway";
import { PostgresGateway } from "./postgres-gateway";

describe.each([
  ["IndexedDB", () => new IndexedRepository(crypto.randomUUID())],
  ["Injected memory adapter", () => new MemoryRepository()],
  ["Cloud adapter", () => new SupabaseRepository(new TestCloudGateway())],
  ...(process.env.COLTIVARE_SQL_TEST_CONTAINER
    ? [
        [
          "PostgreSQL RPC",
          () =>
            new SupabaseRepository(
              new PostgresGateway(process.env.COLTIVARE_SQL_TEST_CONTAINER!),
            ),
        ] as const,
      ]
    : []),
] as const)("%s contract", (_label, create) => {
  let repository: Repository;
  beforeEach(() => {
    repository = create();
  });
  afterEach(async () => repository.close());
  async function setup() {
    const [w] = await repository.list();
    const g = makeRecord("garden", w.id, {
      name: "Köksträdgård",
      width: 20,
      height: 15,
    });
    const plant = makeRecord("plant", w.id, { name: "Exempel" });
    const p = makeRecord("planting", w.id, {
      name: "Omgång",
      plantId: plant.id,
      snapshot: plant,
      count: 2,
      gardenId: g.id,
    });
    const place = makeRecord("placement", w.id, {
      gardenId: g.id,
      plantingId: p.id,
      layer: "actual",
      startDate: "2027-01-01",
      geometry: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        shape: "rectangle",
        rotation: 0,
      },
    });
    await repository.commit(
      [g, plant, p, place].map((after) => ({ after })),
      g.id,
    );
    return { w, g, plant, p, place };
  }
  test("atomic move, invalid rollback and retry without duplicates", async () => {
    const { place, w } = await setup(),
      before = (await repository.list()).find((r) => r.id === place.id)!;
    const next = makeRecord("placement", w.id, {
      ...before,
      id: crypto.randomUUID(),
      revision: 0,
      startDate: "2027-06-01",
      geometry: { ...before.geometry!, x: 10 },
    });
    const previous = await repository.list();
    await expect(repository.commit([{ after: next }])).rejects.toMatchObject({
      code: "validation",
    });
    expect(await repository.list()).toEqual(previous);
    const command = [
      { before, after: { ...before, endDate: "2027-06-01" } },
      { after: next },
    ];
    await repository.commit(command);
    const committed = await repository.list();
    await expect(repository.commit(command)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(await repository.list()).toEqual(committed);
  });
  test("first commit wins and failed composite changes have no side effects", async () => {
    const { plant, w } = await setup(),
      before = (await repository.list()).find((r) => r.id === plant.id)!;
    await repository.commit([
      { before, after: { ...before, name: "Vinnare" } },
    ]);
    const state = await repository.list();
    await expect(
      repository.commit([
        { after: makeRecord("plant", w.id, { name: "Rullas tillbaka" }) },
        { before, after: { ...before, name: "Förlorare" } },
      ]),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await repository.list()).toEqual(state);
  });
  test("consistent export, restore preserving IDs, copy remaps IDs, invalid import is atomic", async () => {
    const { g } = await setup();
    const backup = await repository.export(),
      other = create();
    await other.list();
    await other.import(backup);
    expect(await other.export()).toMatchObject({ records: backup.records });
    await expect(other.import(backup)).rejects.toMatchObject({
      code: "validation",
    });
    await other.close();
    const garden = await repository.export(g.id);
    await repository.import(garden);
    expect(
      (await repository.list()).filter((r) => r.kind === "garden"),
    ).toHaveLength(2);
    const state = await repository.list();
    await expect(
      repository.import({ ...garden, schemaVersion: 99 }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(await repository.list()).toEqual(state);
  });
  test("undo deletes creations and redo restores records and relationships", async () => {
    const { g, p, place } = await setup();
    await repository.travel(g.id, "undo");
    expect(
      (await repository.list()).find((r) => r.id === g.id),
    ).toBeUndefined();
    expect(
      (await repository.list()).find((r) => r.id === place.id),
    ).toBeUndefined();
    await repository.travel(g.id, "redo");
    const restored = await repository.list();
    expect(restored.find((r) => r.id === place.id)?.plantingId).toBe(p.id);
    expect(restored.find((r) => r.id === p.id)?.gardenId).toBe(g.id);
  });
});
