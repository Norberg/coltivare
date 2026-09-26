import { mapLayer, pathGeometry } from "../src/mapLayout";
import { makeRecord, transform } from "../src/domain";
test("beds, paths and plants have deterministic layer priority", () => {
  const records = [
    makeRecord("placement", ""),
    makeRecord("object", "", { category: "Gång" }),
    makeRecord("object", "", { category: "Odlingsland" }),
  ];
  expect(
    records.sort((a, b) => mapLayer(a) - mapLayer(b)).map(mapLayer),
  ).toEqual([0, 1, 2]);
});
test("a diagonal path is centred along the drawn line and retains its width", () => {
  const g = pathGeometry({ x: 2, y: 3 }, { x: 5, y: 7 }, 0.8);
  expect(g.width).toBe(5);
  expect(g.height).toBe(0.8);
  expect(transform({ x: 0, y: g.height / 2 }, g).x).toBeCloseTo(2);
  expect(transform({ x: 0, y: g.height / 2 }, g).y).toBeCloseTo(3);
  expect(transform({ x: g.width, y: g.height / 2 }, g).x).toBeCloseTo(5);
  expect(transform({ x: g.width, y: g.height / 2 }, g).y).toBeCloseTo(7);
});
