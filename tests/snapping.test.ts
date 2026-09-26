import { snapMove } from "../src/snapping";
import { bounds } from "../src/geometry";
import type { Geometry } from "../src/domain";
const square: Geometry = {
  shape: "rectangle",
  x: 1.23,
  y: 2.07,
  width: 3.3,
  height: 3.3,
  rotation: 0,
};
test("two 3.3 metre squares meet exactly at an off-grid edge", () => {
  const raw = { ...square, x: 4.57, y: 2.11 };
  const result = snapMove(raw, [bounds(square)], 0.1, true);
  expect(result.geometry.x).toBeCloseTo(4.53, 12);
  expect(result.geometry.y).toBeCloseTo(2.07, 12);
  expect(result.geometry.width).toBe(3.3);
  expect(result.guides).toHaveLength(2);
});
test("small 33 cm squares meet without grid gaps too", () => {
  const small = { ...square, width: 0.33, height: 0.33 };
  const result = snapMove({ ...small, x: 1.58 }, [bounds(small)], 0.03, true);
  expect(result.geometry.x).toBeCloseTo(1.56, 12);
});
test.each(["left", "above", "below"])("opposing edges snap %s", (side) => {
  const raw = {
    ...square,
    x: side === "left" ? square.x - square.width + 0.03 : square.x,
    y:
      side === "above"
        ? square.y - square.height + 0.03
        : side === "below"
          ? square.y + square.height - 0.03
          : square.y,
  };
  const result = snapMove(raw, [bounds(square)], 0.1, true).geometry;
  if (side === "left") expect(result.x + result.width).toBeCloseTo(square.x);
  if (side === "above") expect(result.y + result.height).toBeCloseTo(square.y);
  if (side === "below") expect(result.y).toBeCloseTo(square.y + square.height);
});
test("the nearest edge wins and distant shapes are ignored", () => {
  const result = snapMove(
    { ...square, x: 4.57 },
    [
      bounds({ ...square, x: 1.18 }),
      bounds(square),
      bounds({ ...square, x: 1.27, y: 50 }),
    ],
    0.1,
    false,
  );
  expect(result.geometry.x).toBeCloseTo(4.53);
});
test("grid remains a fallback and each snapping option can be disabled", () => {
  const raw = { ...square, x: 8.17, y: 9.26 };
  expect(snapMove(raw, [bounds(square)], 0.1, true).geometry).toMatchObject({
    x: 8.2,
    y: 9.3,
  });
  expect(snapMove(raw, [], 0.1, false).geometry).toEqual(raw);
  expect(
    snapMove({ ...square, x: 4.57 }, [bounds(square)], 0.1, false).geometry.x,
  ).toBeCloseTo(4.53);
});
