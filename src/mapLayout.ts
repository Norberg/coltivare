import type { Geometry, Point, RecordData } from "./domain";

export function mapLayer(record: RecordData): number {
  return record.kind === "placement" ? 2 : record.category === "Gång" ? 1 : 0;
}

/** A path is a regular, editable structure, centred along the dragged line. */
export function pathGeometry(
  start: Point,
  end: Point,
  width: number,
): Geometry {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  return {
    shape: "rectangle",
    x: start.x + (Math.sin(angle) * width) / 2,
    y: start.y - (Math.cos(angle) * width) / 2,
    width: Math.max(0.1, Math.hypot(dx, dy)),
    height: width,
    rotation: (angle * 180) / Math.PI,
  };
}
