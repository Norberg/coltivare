import {
  transform,
  worldGeometry,
  type Change,
  type Geometry,
  type Point,
  type RecordData,
} from "./domain";
import { bounds } from "./geometry";

export function groupBounds(
  records: RecordData[],
  all: RecordData[],
): Geometry {
  const boxes = records.map((r) => bounds(worldGeometry(r, all)));
  const x = Math.min(...boxes.map((b) => b.minX)),
    y = Math.min(...boxes.map((b) => b.minY));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.maxX)) - x,
    height: Math.max(...boxes.map((b) => b.maxY)) - y,
    rotation: 0,
    shape: "rectangle",
  };
}

/** One transaction; children whose parent is moved retain their local geometry. */
export function translateGroup(
  records: RecordData[],
  all: RecordData[],
  delta: Point,
): Change[] {
  const roots = records.filter((r) => r.geometry && !r.locked);
  const ids = new Set(roots.map((r) => r.id));
  return roots
    .filter((r) => !r.objectId || !ids.has(r.objectId))
    .map((before) => {
      const g = worldGeometry(before, all);
      const parent = all.find((r) => r.id === before.objectId)?.geometry;
      const position = { x: g.x + delta.x, y: g.y + delta.y };
      const local = parent ? transform(position, parent, true) : position;
      return {
        before,
        after: { ...before, geometry: { ...before.geometry!, ...local } },
      };
    });
}
