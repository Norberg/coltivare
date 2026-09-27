import {
  active,
  addDays,
  makeRecord,
  overlaps,
  parseSnapshot,
  periodsOverlap,
  shiftDate,
  transform,
  validDate,
  validateGeometry,
  validateRecords,
  type Geometry,
} from "../src/domain";
const rect: Geometry = {
  x: 0,
  y: 0,
  width: 2,
  height: 2,
  rotation: 0,
  shape: "rectangle",
};
test("mixed planting validates independent species snapshots and rejects malformed mixtures", () => {
  const id = crypto.randomUUID();
  const w = makeRecord("workspace", id, { id });
  const g = makeRecord("garden", id, {
    name: "Trädgård",
    width: 20,
    height: 15,
  });
  const a = makeRecord("plant", id, { name: "Lavendel" });
  const b = makeRecord("plant", id, { name: "Blåklint" });
  const p = makeRecord("planting", id, {
    name: "Blomsteräng",
    gardenId: g.id,
    count: 100,
    plantId: a.id,
    snapshot: a,
    additionalPlants: [b],
  });
  expect(() => validateRecords([w, g, a, b, p])).not.toThrow();
  for (const invalid of [
    [a],
    [b, b],
    [null],
    "bad",
    [{ ...b, id: crypto.randomUUID() }],
    [{ ...b, workspaceId: crypto.randomUUID() }],
  ]) {
    expect(() =>
      validateRecords([
        w,
        g,
        a,
        b,
        { ...p, additionalPlants: invalid as never },
      ]),
    ).toThrow();
  }
  expect(() => validateRecords([w, { ...a, additionalPlants: [b] }])).toThrow();
});
test("optional appearance metadata validates colors and known icons, preserving old records", () => {
  const w = makeRecord("workspace", crypto.randomUUID());
  w.workspaceId = w.id;
  const p = makeRecord("plant", w.id, { name: "Lavendel" });
  expect(() => validateRecords([w, p])).not.toThrow();
  expect(() => validateRecords([w, { ...p, showName: false }])).not.toThrow();
  expect(() =>
    validateRecords([w, { ...p, showName: "no" as never }]),
  ).toThrow();
  expect(() =>
    validateRecords([w, { ...p, color: "#aabbcc", icon: "lavender" }]),
  ).not.toThrow();
  expect(() =>
    validateRecords([w, { ...p, color: "url(https://example.com)" }]),
  ).toThrow();
  expect(() =>
    validateRecords([w, { ...p, icon: "<svg>" as never }]),
  ).toThrow();
  expect(() =>
    validateRecords([w, { ...p, icon: "toString" as never }]),
  ).toThrow();
});
test("calendar dates preserve leap days, exclusive ends and month boundaries", () => {
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
  expect(shiftDate("2028-01-31", 1)).toBe("2028-02-29");
  expect(shiftDate("2028-02-29", 12)).toBe("2029-02-28");
  expect(validDate("2027-02-29")).toBe(false);
  expect(validDate("2027-13-01")).toBe(false);
  const p = makeRecord("placement", "", {
    startDate: "2027-04-15",
    endDate: addDays("2027-08-31", 1),
  });
  expect(
    ["2027-04-14", "2027-04-15", "2027-08-31", "2027-09-01"].map((d) =>
      active(p, d),
    ),
  ).toEqual([false, true, true, false]);
});
test("unknown start is open backwards and adjacent periods do not overlap", () => {
  const a = makeRecord("placement", "", {
      unknownStart: true,
      endDate: "2027-06-01",
    }),
    b = makeRecord("placement", "", { startDate: "2027-06-01" });
  expect(active(a, "1900-01-01")).toBe(true);
  expect(periodsOverlap(a, b)).toBe(false);
});
test("geometry transforms are invertible and preserve relative distances", () => {
  const parent = { ...rect, x: 8, y: 6, rotation: 73 };
  const point = { x: 2, y: 3 };
  const world = transform(point, parent);
  const local = transform(world, parent, true);
  expect(local.x).toBeCloseTo(2);
  expect(local.y).toBeCloseTo(3);
});
test("zero area and crossing polygons are rejected", () => {
  expect(() => validateGeometry({ ...rect, width: 0 })).toThrow();
  expect(() =>
    validateGeometry({
      ...rect,
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
        { x: 2, y: 0 },
      ],
    }),
  ).toThrow();
  expect(() =>
    validateGeometry({
      ...rect,
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
    }),
  ).not.toThrow();
});
test("positive area overlap excludes touching edges", () => {
  expect(overlaps(rect, { ...rect, x: 2 })).toBe(false);
  expect(overlaps(rect, { ...rect, x: 1.9 })).toBe(true);
  expect(overlaps(rect, rect)).toBe(true);
  expect(
    overlaps(
      { ...rect, shape: "ellipse" },
      { ...rect, shape: "ellipse", x: 2 },
    ),
  ).toBe(false);
});
test("bad imports and references are rejected", () => {
  expect(() => parseSnapshot({ schemaVersion: 2 })).toThrow();
  expect(() =>
    validateRecords([makeRecord("plant", "missing", { name: "X" })]),
  ).toThrow();
});
