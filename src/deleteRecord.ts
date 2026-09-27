import {
  DomainError,
  worldGeometry,
  type Change,
  type RecordData,
} from "./domain";

/** Builds one atomic, undoable command for deleting a persisted record. */
export function deleteRecordChanges(
  record: RecordData,
  records: RecordData[],
): Change[] {
  if (!record.revision)
    throw new DomainError("validation", "Posten är inte sparad ännu.");
  if (record.kind === "workspace")
    throw new DomainError("validation", "Arbetsytan kan inte tas bort.");

  if (record.kind === "plant") {
    const usedBy = records.find(
      (candidate) =>
        candidate.kind === "planting" &&
        (candidate.plantId === record.id ||
          candidate.additionalPlants?.some((plant) => plant.id === record.id)),
    );
    if (usedBy)
      throw new DomainError(
        "validation",
        `Växten används i planteringen ${usedBy.name} och kan inte tas bort.`,
      );
  }

  const deleteIds = new Set([record.id]);
  if (record.kind === "garden") {
    for (const candidate of records)
      if (candidate.gardenId === record.id) deleteIds.add(candidate.id);
  } else if (record.kind === "planting") {
    for (const candidate of records)
      if (
        (candidate.kind === "placement" &&
          candidate.plantingId === record.id) ||
        (candidate.kind === "event" && candidate.targetId === record.id)
      )
        deleteIds.add(candidate.id);
  } else if (record.kind === "object") {
    for (const candidate of records)
      if (candidate.kind === "event" && candidate.targetId === record.id)
        deleteIds.add(candidate.id);
  }

  const changes: Change[] = [];
  for (const candidate of records) {
    if (deleteIds.has(candidate.id)) {
      changes.push({ before: candidate });
      continue;
    }
    if (
      record.kind === "object" &&
      candidate.kind === "placement" &&
      candidate.objectId === record.id
    ) {
      const after = {
        ...candidate,
        geometry: worldGeometry(candidate, records),
      };
      delete after.objectId;
      changes.push({ before: candidate, after });
    }
    if (
      record.kind === "garden" &&
      candidate.kind === "workspace" &&
      candidate.lastGardenId === record.id
    ) {
      const after = { ...candidate };
      delete after.lastGardenId;
      changes.push({ before: candidate, after });
    }
  }
  return changes;
}
