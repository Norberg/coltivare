import {
  active,
  overlaps,
  periodsOverlap,
  worldGeometry,
  type RecordData,
} from "./domain";
import { bounds, containsShape } from "./geometry";
export function gardenWarnings(
  records: RecordData[],
  gardenId: string | undefined,
  date: string,
): string[] {
  const warnings: string[] = [];
  const byId = new Map(records.map((r) => [r.id, r]));
  const items = records
    .filter(
      (r) =>
        r.kind === "placement" &&
        r.gardenId === gardenId,
    )
    .map((record) => {
      const geometry = worldGeometry(record, records),
        parent = byId.get(record.objectId!);
      if (parent) {
        if (
          (active(record, date) && !active(parent, date)) ||
          (parent.startDate &&
            (!record.startDate || record.startDate < parent.startDate)) ||
          (parent.endDate &&
            (!record.endDate || record.endDate > parent.endDate))
        )
          warnings.push(
            `${record.name}: den kopplade ytans visningsperiod täcker inte hela placeringen.`,
          );
        if (!containsShape(parent.geometry!, geometry))
          warnings.push(
            `${record.name}: utbredningen går utanför den kopplade ytan.`,
          );
      }
      return {
        record,
        geometry,
        ...bounds(geometry),
      };
    })
    .sort((a, b) => a.minX - b.minX);
  // Sweep on X before doing the more expensive rotated-shape intersection.
  for (let i = 0; i < items.length; i++)
    for (
      let j = i + 1;
      j < items.length && items[j].minX < items[i].maxX;
      j++
    ) {
      const a = items[i],
        b = items[j];
      if (
        a.minY < b.maxY &&
        b.minY < a.maxY &&
        periodsOverlap(a.record, b.record) &&
        overlaps(a.geometry, b.geometry)
      )
        warnings.push(
          `${a.record.name} och ${b.record.name} överlappar i tid och rum. Samodling är tillåten.`,
        );
    }
  return warnings;
}
