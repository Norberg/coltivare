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

test("unchanged workspaces use tiny version checks; successful local saves reuse their confirmed contents", async () => {
  const server = new TestCloudGateway();
  const read = jest.spyOn(server, "read"),
    version = jest.spyOn(server, "version");
  const time = jest.spyOn(Date, "now").mockReturnValue(10000);
  const repository = new SupabaseRepository(server);
  try {
    const [records] = await Promise.all([
      repository.list(),
      repository.list(),
      repository.list(),
    ]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(version).not.toHaveBeenCalled();
    const workspace = records.find((r) => r.kind === "workspace")!;
    for (let minute = 1; minute <= 5; minute++) {
      time.mockReturnValue(10000 + minute * 60000);
      await repository.list();
    }
    expect(version).toHaveBeenCalledTimes(5);
    expect(read).toHaveBeenCalledTimes(1);
    const garden = makeRecord("garden", workspace.id, {
      name: "Sparad",
      width: 10,
      height: 10,
    });
    await repository.commit([{ after: garden }], garden.id);
    expect((await repository.list()).some((r) => r.id === garden.id)).toBe(
      true,
    );
    expect((await repository.history(garden.id)).undo).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(version).toHaveBeenCalledTimes(6);
    const other = new SupabaseRepository(server);
    const before = (await other.list()).find((r) => r.id === garden.id)!;
    await other.commit([{ before, after: { ...before, name: "Annan enhet" } }]);
    time.mockReturnValue(400000);
    expect(
      (await repository.list()).find((r) => r.id === garden.id)?.name,
    ).toBe("Annan enhet");
    expect(read).toHaveBeenCalledTimes(3); // Other device's initial read, then this device reads the new version.
    await other.close();
  } finally {
    time.mockRestore();
    await repository.close();
  }
});

test("periodic checks stop in hidden or offline tabs and resume on return", async () => {
  jest.useFakeTimers();
  const visibility = jest
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  const online = jest.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const repository = new SupabaseRepository(new TestCloudGateway());
  const listener = jest.fn();
  const unsubscribe = repository.subscribe(listener);
  try {
    jest.advanceTimersByTime(60000);
    expect(listener).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("hidden");
    jest.advanceTimersByTime(600000);
    expect(listener).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(2);
    online.mockReturnValue(false);
    jest.advanceTimersByTime(600000);
    expect(listener).toHaveBeenCalledTimes(2);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    jest.advanceTimersByTime(60000);
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledTimes(3);
  } finally {
    await repository.close();
    visibility.mockRestore();
    online.mockRestore();
    jest.useRealTimers();
  }
});

test("concurrent saves in one tab preserve both operations", async () => {
  const repository = new SupabaseRepository(new TestCloudGateway());
  const workspace = (await repository.list()).find(
    (r) => r.kind === "workspace",
  )!;
  const gardens = ["Ett", "Två"].map((name) =>
    makeRecord("garden", workspace.id, { name, width: 10, height: 10 }),
  );
  await Promise.all(
    gardens.map((garden) => repository.commit([{ after: garden }])),
  );
  const records = await repository.list();
  expect(
    gardens.every((garden) => records.some((r) => r.id === garden.id)),
  ).toBe(true);
  await repository.close();
});
