import type { Geometry } from "./domain";
import { bounds } from "./geometry";

export type SnapBounds = ReturnType<typeof bounds>;
export interface SnapGuide {
  axis: "x" | "y";
  value: number;
  from: number;
  to: number;
}

/** Snap visible outer edges in world coordinates. Edge matches take precedence over the grid. */
export function snapMove(
  geometry: Geometry,
  targets: SnapBounds[],
  tolerance: number,
  grid: boolean,
) {
  const box = bounds(geometry);
  const best: Partial<
    Record<"x" | "y", { delta: number; value: number; target: SnapBounds }>
  > = {};
  for (const target of targets) {
    for (const axis of ["x", "y"] as const) {
      const min = axis === "x" ? "minX" : "minY",
        max = axis === "x" ? "maxX" : "maxY";
      const crossMin = axis === "x" ? "minY" : "minX",
        crossMax = axis === "x" ? "maxY" : "maxX";
      if (
        box[crossMax] < target[crossMin] - tolerance ||
        box[crossMin] > target[crossMax] + tolerance
      )
        continue;
      for (const source of [box[min], box[max]])
        for (const value of [target[min], target[max]]) {
          const delta = value - source;
          if (
            Math.abs(delta) <= tolerance &&
            (!best[axis] || Math.abs(delta) < Math.abs(best[axis]!.delta))
          )
            best[axis] = { delta, value, target };
        }
    }
  }
  const result = {
    ...geometry,
    x: best.x
      ? geometry.x + best.x.delta
      : grid
        ? Math.round(geometry.x * 10) / 10
        : geometry.x,
    y: best.y
      ? geometry.y + best.y.delta
      : grid
        ? Math.round(geometry.y * 10) / 10
        : geometry.y,
  };
  const moved = bounds(result);
  const guides: SnapGuide[] = [];
  for (const axis of ["x", "y"] as const) {
    const match = best[axis];
    if (!match) continue;
    const min = axis === "x" ? "minY" : "minX",
      max = axis === "x" ? "maxY" : "maxX";
    guides.push({
      axis,
      value: match.value,
      from: Math.min(moved[min], match.target[min]),
      to: Math.max(moved[max], match.target[max]),
    });
  }
  return { geometry: result, guides };
}
