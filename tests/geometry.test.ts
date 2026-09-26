import { bounds, containsShape, overlaps } from "../src/geometry";
import type { Geometry } from "../src/domain";
const circle: Geometry = {
  x: 0,
  y: 0,
  width: 2,
  height: 2,
  rotation: 0,
  shape: "ellipse",
};
test("curved contours detect very small overlaps and exclude tangency at every angle", () => {
  for (const angle of [0, 0.01, 0.2, 0.9, 1.5, 2.8]) {
    const other = { ...circle, x: 2 * Math.cos(angle), y: 2 * Math.sin(angle) };
    expect(overlaps(circle, other)).toBe(false);
    expect(
      overlaps(circle, {
        ...other,
        x: other.x * 0.999999,
        y: other.y * 0.999999,
      }),
    ).toBe(true);
  }
});
test("rotated ellipses and polygons have symmetric overlap and exact extrema", () => {
  const a = { ...circle, width: 6, height: 1, rotation: 45 },
    b = { ...circle, x: 1, y: 2 };
  expect(overlaps(a, b)).toBe(overlaps(b, a));
  const box = bounds(a);
  expect(box.maxX - box.minX).toBeCloseTo(Math.sqrt(18.5));
  expect(overlaps(circle, { ...circle, shape: "rectangle", x: 2 })).toBe(false);
  expect(overlaps(circle, { ...circle, shape: "rectangle", x: 1.999999 })).toBe(
    true,
  );
});
test("concave identical and contained polygons overlap, separate notch does not", () => {
  const p: Geometry = {
    x: 0,
    y: 0,
    width: 4,
    height: 4,
    rotation: 0,
    shape: "polygon",
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ],
  };
  expect(overlaps(p, p)).toBe(true);
  expect(overlaps(p, { ...circle, x: 1.5, y: 1.5 })).toBe(false);
  expect(
    containsShape(p, { ...circle, x: 0.1, y: 0.1, width: 0.5, height: 0.5 }),
  ).toBe(true);
  expect(
    containsShape(p, { ...circle, x: 0.8, y: 0.8, width: 1, height: 1 }),
  ).toBe(false);
});
test("containment respects exact ellipse boundaries and a concave notch crossing", () => {
  expect(containsShape(circle, circle)).toBe(true);
  expect(
    containsShape(circle, {
      ...circle,
      width: 0.4,
      height: 0.4,
      x: 1.6,
      y: 0.8,
    }),
  ).toBe(true);
  expect(
    containsShape(circle, {
      ...circle,
      width: 0.4,
      height: 0.4,
      x: 1.600001,
      y: 0.8,
    }),
  ).toBe(false);
  expect(containsShape({ ...circle, shape: "rectangle" }, circle)).toBe(true);
  expect(
    containsShape(
      { ...circle, shape: "rectangle" },
      { ...circle, x: 0.000001 },
    ),
  ).toBe(false);
  const parent: Geometry = {
    ...circle,
    width: 4,
    height: 4,
    shape: "polygon",
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ],
  };
  expect(
    containsShape(parent, {
      ...circle,
      shape: "rectangle",
      x: 0.5,
      y: 0.5,
      width: 3,
      height: 2,
    }),
  ).toBe(false);
});
