import { transform, type Geometry, type Point } from "./domain";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";
export function resizeBounds(g: Geometry) {
  return {
    x: g.shape === "polygon" ? Math.min(...g.points!.map((p) => p.x)) : 0,
    y: g.shape === "polygon" ? Math.min(...g.points!.map((p) => p.y)) : 0,
  };
}

/** Resize in the object's axes, keeping the opposite corner fixed. */
export function resizeGeometry(
  g: Geometry,
  corner: ResizeCorner,
  delta: Point,
  snap: boolean,
): Geometry {
  const west = corner.includes("w"),
    north = corner.includes("n");
  const rounded = (v: number) =>
    Math.max(0.1, snap ? Math.round(v * 10) / 10 : v);
  const width = rounded(g.width + (west ? -delta.x : delta.x));
  const height = rounded(g.height + (north ? -delta.y : delta.y));
  const origin = transform(
    { x: west ? g.width - width : 0, y: north ? g.height - height : 0 },
    g,
  );
  const min = resizeBounds(g);
  return {
    ...g,
    ...origin,
    width,
    height,
    ...(g.shape === "polygon"
      ? {
          points: g.points!.map((p) => ({
            x: min.x + ((p.x - min.x) * width) / g.width,
            y: min.y + ((p.y - min.y) * height) / g.height,
          })),
        }
      : {}),
  };
}
