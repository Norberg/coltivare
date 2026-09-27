export interface LabelCandidate {
  id: string;
  x: number;
  y: number;
  lines: string[];
  fontSize: number;
  className?: string;
  /** Higher values replace colliding, lower-priority labels. */
  priority: number;
}

interface LabelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function bounds(label: LabelCandidate): LabelBounds {
  const longest = Math.max(...label.lines.map((line) => line.length), 0);
  const width = longest * label.fontSize * 0.56;
  const height = Math.max(1, label.lines.length) * label.fontSize * 1.2;
  return {
    left: label.x - width / 2,
    right: label.x + width / 2,
    top: label.y - label.fontSize,
    bottom: label.y - label.fontSize + height,
  };
}

function intersects(a: LabelCandidate, b: LabelCandidate) {
  const one = bounds(a),
    two = bounds(b);
  return (
    one.left < two.right &&
    two.left < one.right &&
    one.top < two.bottom &&
    two.top < one.bottom
  );
}

/**
 * Keeps the map readable by showing only one label in a collision cluster.
 * Higher-priority candidates, such as selected objects, replace ordinary
 * labels in their cluster. Preserved labels always win, allowing an in-zoom
 * to fill newly available space without removing anything already visible.
 */
export function layoutLabels(
  candidates: LabelCandidate[],
  preservedIds?: ReadonlySet<string>,
): LabelCandidate[] {
  const visible = candidates.filter((candidate) =>
    preservedIds?.has(candidate.id),
  );
  for (const candidate of candidates) {
    if (preservedIds?.has(candidate.id)) continue;
    const colliding = visible.filter((label) => intersects(label, candidate));
    if (colliding.some((label) => preservedIds?.has(label.id))) continue;
    if (colliding.some((label) => label.priority >= candidate.priority))
      continue;
    for (const label of colliding) visible.splice(visible.indexOf(label), 1);
    visible.push(candidate);
  }
  return visible;
}

export function shouldPreserveLabels(
  previousWidth: number,
  currentWidth: number,
  sameLayout: boolean,
) {
  return sameLayout && currentWidth <= previousWidth;
}
