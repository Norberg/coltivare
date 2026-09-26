import { resizeGeometry, resizeBounds } from "../src/resize";
import { transform, type Geometry } from "../src/domain";
const base: Geometry = {
  x: 10,
  y: 20,
  width: 4,
  height: 2,
  rotation: 35,
  shape: "rectangle",
};
test.each(["nw", "ne", "sw", "se"] as const)(
  "resizing %s preserves the opposite corner under rotation",
  (corner) => {
    const result = resizeGeometry(base, corner, { x: 1, y: 0.5 }, false);
    const opposite = (g: Geometry) =>
      transform(
        {
          x: corner.includes("w") ? g.width : 0,
          y: corner.includes("n") ? g.height : 0,
        },
        g,
      );
    expect(opposite(result).x).toBeCloseTo(opposite(base).x);
    expect(opposite(result).y).toBeCloseTo(opposite(base).y);
    expect(result.rotation).toBe(35);
  },
);
test("polygon resize scales every vertex including nonzero local bounds", () => {
  const g: Geometry = {
    ...base,
    shape: "polygon",
    points: [
      { x: -2, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 3 },
    ],
  };
  const resized = resizeGeometry(g, "se", { x: 4, y: 2 }, false);
  expect(resized.points).toEqual([
    { x: -2, y: 1 },
    { x: 6, y: 1 },
    { x: 2, y: 5 },
  ]);
  expect(resizeBounds(resized)).toEqual({ x: -2, y: 1 });
});
test("ellipse dimensions snap and cannot collapse or invert", () => {
  expect(
    resizeGeometry(
      { ...base, shape: "ellipse" },
      "se",
      { x: 0.24, y: 0.26 },
      true,
    ),
  ).toMatchObject({ width: 4.2, height: 2.3, shape: "ellipse" });
  expect(resizeGeometry(base, "se", { x: -100, y: -100 }, false)).toMatchObject(
    { width: 0.1, height: 0.1 },
  );
});
