import { groupBounds, translateGroup } from "../src/groupMove";
import { makeRecord, worldGeometry } from "../src/domain";
import { IndexedRepository } from "../src/repository";
function records() {
  const w = makeRecord("workspace", crypto.randomUUID());
  w.workspaceId = w.id;
  const garden = makeRecord("garden", w.id, {
    name: "Trädgård",
    width: 20,
    height: 15,
  });
  const a = makeRecord("object", w.id, {
    name: "A",
    gardenId: garden.id,
    geometry: {
      shape: "rectangle",
      x: 2,
      y: 3,
      width: 3,
      height: 2,
      rotation: 30,
    },
  });
  const b = makeRecord("object", w.id, {
    ...a,
    id: crypto.randomUUID(),
    name: "B",
    geometry: { ...a.geometry!, x: 8 },
  });
  const child = makeRecord("placement", w.id, {
    gardenId: garden.id,
    objectId: a.id,
    geometry: {
      shape: "rectangle",
      x: 0.3,
      y: 0.5,
      width: 0.4,
      height: 0.4,
      rotation: 10,
    },
  });
  return { w, garden, a, b, child, all: [w, garden, a, b, child] };
}
test("a group translates by one common vector without resizing or rotation", () => {
  const { a, b, all } = records();
  const changes = translateGroup([a, b], all, { x: 1.23, y: -0.47 });
  for (const c of changes) {
    expect(c.after!.geometry!.x - c.before!.geometry!.x).toBeCloseTo(1.23);
    expect(c.after!.geometry!.y - c.before!.geometry!.y).toBeCloseTo(-0.47);
    expect(c.after!.geometry!.rotation).toBe(30);
  }
  expect(groupBounds([a, b], all).width).toBeGreaterThan(8);
});
test("bound children move exactly once, including under a rotated parent", () => {
  const { a, child, all } = records();
  const changes = translateGroup([a, child], all, { x: 2, y: 1 });
  expect(changes).toHaveLength(1);
  expect(changes[0].before!.id).toBe(a.id);
  const updated = all.map((r) => (r.id === a.id ? changes[0].after! : r));
  expect(
    worldGeometry(child, updated).x - worldGeometry(child, all).x,
  ).toBeCloseTo(2);
  const alone = translateGroup([child], all, { x: 2, y: 1 })[0].after!;
  expect(worldGeometry(alone, all).x - worldGeometry(child, all).x).toBeCloseTo(
    2,
  );
  expect(worldGeometry(alone, all).y - worldGeometry(child, all).y).toBeCloseTo(
    1,
  );
});
test("locked objects are excluded from group writes", () => {
  const { a, b, all } = records();
  expect(
    translateGroup([a, { ...b, locked: true }], all, { x: 1, y: 1 }),
  ).toHaveLength(1);
});
test("a repository group move rolls back on conflict and undoes as one command", async () => {
  const repo = new IndexedRepository(crypto.randomUUID());
  try {
    const [w] = await repo.list();
    const fixture = records();
    const initial = [fixture.garden, fixture.a, fixture.b].map((r) => ({
      ...r,
      workspaceId: w.id,
    }));
    await repo.commit(initial.map((after) => ({ after })));
    const all = await repo.list(),
      objects = all.filter((r) => r.kind === "object");
    const changes = translateGroup(objects, all, { x: 2, y: 1 });
    await expect(
      repo.commit(
        [
          changes[0],
          { ...changes[1], before: { ...changes[1].before!, revision: 99 } },
        ],
        fixture.garden.id,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await repo.list()).filter((r) => r.kind === "object")).toEqual(
      objects,
    );
    await repo.commit(changes, fixture.garden.id);
    await repo.travel(fixture.garden.id, "undo");
    const restored = (await repo.list()).filter((r) => r.kind === "object");
    expect(restored.map((r) => r.geometry)).toEqual(
      objects.map((r) => r.geometry),
    );
  } finally {
    await repo.close();
  }
});
