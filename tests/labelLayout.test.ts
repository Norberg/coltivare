import {
  layoutLabels,
  shouldPreserveLabels,
  type LabelCandidate,
} from "../src/labelLayout";

const label = (id: string, x: number, priority = 0): LabelCandidate => ({
  id,
  x,
  y: 4,
  lines: [id],
  fontSize: 1,
  priority,
});

test("label layout preserves separated labels and hides collisions", () => {
  expect(
    layoutLabels([label("A", 1), label("B", 10)]).map((item) => item.id),
  ).toEqual(["A", "B"]);
  expect(
    layoutLabels([label("A", 1), label("B", 1.2), label("C", 1.4)]).map(
      (item) => item.id,
    ),
  ).toEqual(["A"]);
});

test("selected labels replace ordinary collision clusters", () => {
  const labels = layoutLabels([
    label("first", 1),
    label("second", 1.2),
    label("selected", 1.3, 10),
  ]);
  expect(labels.map((item) => item.id)).toEqual(["selected"]);
});

test("preserved labels cannot be displaced by newly available labels", () => {
  const zoomedIn = layoutLabels(
    [label("already visible", 1), label("new at zoom", 1.2, 20)],
    new Set(["already visible"]),
  );
  expect(zoomedIn.map((item) => item.id)).toEqual(["already visible"]);
});

test("labels stay sticky after the zoom render has settled", () => {
  expect(shouldPreserveLabels(10, 8, true)).toBe(true);
  expect(shouldPreserveLabels(8, 8, true)).toBe(true);
  expect(shouldPreserveLabels(8, 10, true)).toBe(false);
  expect(shouldPreserveLabels(10, 8, false)).toBe(false);
});

test("a higher map layer replaces a colliding background label", () => {
  expect(
    layoutLabels([label("bed", 1), label("plant", 1.1, 2)]).map(
      (item) => item.id,
    ),
  ).toEqual(["plant"]);
});
