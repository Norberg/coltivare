import { mixtureLayout } from "../src/mixtureLayout";
import { makeRecord, type Geometry } from "../src/domain";
import { containsShape } from "../src/geometry";

const plants = [
  makeRecord("plant", "", { icon: "lavender" }),
  makeRecord("plant", "", { icon: "cornflower" }),
  makeRecord("plant", "", { icon: "crocus" }),
];
test.each(["rectangle", "ellipse"] as const)(
  "%s mixes species across the area without overlap or spill",
  (shape) => {
    const g: Geometry = { x: 0, y: 0, width: 8, height: 5, rotation: 0, shape };
    const icons = mixtureLayout(g, plants);
    expect(icons.length).toBeGreaterThan(6);
    expect(new Set(icons.map((item) => item.icon)).size).toBe(3);
    expect(
      Math.max(...icons.map((item) => item.x)) -
        Math.min(...icons.map((item) => item.x)),
    ).toBeGreaterThan(4);
    expect(
      Math.max(...icons.map((item) => item.y)) -
        Math.min(...icons.map((item) => item.y)),
    ).toBeGreaterThan(2);
    icons.forEach((a, i) => {
      expect(
        containsShape(g, {
          x: a.x,
          y: a.y,
          width: a.size,
          height: a.size,
          shape: "rectangle",
          rotation: 0,
        }),
      ).toBe(true);
      for (const b of icons.slice(i + 1))
        expect(
          a.x + a.size <= b.x ||
            b.x + b.size <= a.x ||
            a.y + a.size <= b.y ||
            b.y + b.size <= a.y,
        ).toBe(true);
    });
    expect(mixtureLayout({ ...g, x: 99, y: 42, rotation: 73 }, plants)).toEqual(
      icons,
    );
  },
);
test("missing icons are omitted and large or narrow areas have a bounded layout", () => {
  for (const [width, height] of [
    [0.1, 30],
    [30, 0.1],
    [1000, 1000],
    [0.1, 0.1],
  ]) {
    const g: Geometry = {
      x: 0,
      y: 0,
      width,
      height,
      rotation: 0,
      shape: "rectangle",
    };
    expect(
      mixtureLayout(g, [makeRecord("plant", "", { icon: "none" })]),
    ).toEqual([]);
    const icons = mixtureLayout(g, plants);
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.length).toBeLessThanOrEqual(96);
    expect(
      icons.every(
        (item) =>
          item.x >= 0 &&
          item.y >= 0 &&
          item.x + item.size <= width &&
          item.y + item.size <= height,
      ),
    ).toBe(true);
  }
});
