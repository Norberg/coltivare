import { SupabaseRepository } from "../src/supabaseRepository";
import { TestCloudGateway } from "./cloud-gateway";
import { IndexedRepository } from "../src/repository";
import { makeRecord } from "../src/domain";

test("restoring a workspace without plants persists seeding once across devices", async () => {
  const server = new TestCloudGateway();
  const first = new SupabaseRepository(server),
    second = new SupabaseRepository(server);
  await first.list();
  const id = crypto.randomUUID();
  await first.import(
    {
      schemaVersion: 1,
      exportKind: "workspace",
      exportedAt: new Date().toISOString(),
      records: [
        makeRecord("workspace", id, { id, name: "Återställd", revision: 1 }),
      ],
    },
    { replaceWorkspace: true },
  );
  const [one, two] = await Promise.all([first.list(), second.list()]);
  expect(one).toEqual(two);
  expect(one.filter((r) => r.kind === "plant").length).toBeGreaterThan(0);
  expect(await first.list()).toEqual(one);
  await first.close();
  await second.close();
});

test("two devices reject stale edits and compare-and-swap races without overwriting", async () => {
  const server = new TestCloudGateway();
  const first = new SupabaseRepository(server),
    second = new SupabaseRepository(server);
  const workspace = (await first.list()).find((r) => r.kind === "workspace")!;
  await first.commit([
    {
      after: makeRecord("garden", workspace.id, {
        name: "Trädgård",
        width: 20,
        height: 10,
      }),
    },
  ]);
  const before = (await second.list()).find((r) => r.kind === "garden")!;
  await first.commit([{ before, after: { ...before, name: "Enhet ett" } }]);
  await expect(
    second.commit([{ before, after: { ...before, name: "Enhet två" } }]),
  ).rejects.toMatchObject({ code: "conflict" });
  expect((await second.list()).find((r) => r.id === before.id)?.name).toBe(
    "Enhet ett",
  );
  const fresh = (await first.list()).find((r) => r.id === before.id)!;
  const results = await Promise.allSettled([
    first.commit([
      { before: fresh, after: { ...fresh, name: "Samtidig ett" } },
    ]),
    second.commit([
      { before: fresh, after: { ...fresh, name: "Samtidig två" } },
    ]),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  await first.close();
  await second.close();
});

test("failed and ambiguous writes do not become successful local writes or duplicate records", async () => {
  const server = new TestCloudGateway(),
    repository = new SupabaseRepository(server);
  const workspace = (await repository.list()).find(
    (r) => r.kind === "workspace",
  )!;
  const garden = makeRecord("garden", workspace.id, {
    name: "Odlingsplats",
    width: 10,
    height: 10,
  });
  server.failWrite = true;
  await expect(repository.commit([{ after: garden }])).rejects.toMatchObject({
    code: "unavailable",
  });
  expect(
    (await repository.list()).find((r) => r.id === garden.id),
  ).toBeUndefined();
  server.failWrite = false;
  server.loseResponse = true;
  await expect(repository.commit([{ after: garden }])).rejects.toMatchObject({
    code: "unavailable",
  });
  server.loseResponse = false;
  await expect(repository.commit([{ after: garden }])).rejects.toMatchObject({
    code: "conflict",
  });
  expect(
    (await repository.list()).filter((r) => r.id === garden.id),
  ).toHaveLength(1);
  await repository.close();
});

test("local backup migration preserves records, IDs and history; original local data survives", async () => {
  const local = new IndexedRepository(crypto.randomUUID());
  const workspace = (await local.list()).find((r) => r.kind === "workspace")!;
  const garden = makeRecord("garden", workspace.id, {
    name: "Lokalt",
    width: 10,
    height: 10,
  });
  await local.commit([{ after: garden }], garden.id);
  const backup = JSON.parse(JSON.stringify(await local.export()));
  const cloud = new SupabaseRepository(new TestCloudGateway());
  await cloud.list();
  await cloud.import(backup);
  expect(await cloud.export()).toMatchObject({
    records: backup.records,
    histories: backup.histories,
  });
  expect(await local.export()).toMatchObject({
    records: backup.records,
    histories: backup.histories,
  });
  await cloud.travel(garden.id, "undo");
  expect((await cloud.list()).find((r) => r.id === garden.id)).toBeUndefined();
  expect((await local.list()).find((r) => r.id === garden.id)).toBeDefined();
  await cloud.close();
  await local.close();
});
