import { makeRecord, type RecordData } from "./domain";
import {
  defaultPlantIconVariant,
  plantIcons,
  type PlantIconId,
} from "./plantAppearance";

export const defaultPlantsVersion = "2";
const marker = "defaultPlantsVersion";
const names = Object.entries(plantIcons) as [PlantIconId, string][];

/** Seed only an empty workspace. Existing garden and plant data is never reclassified on read. */
export function seedDefaultPlants(records: RecordData[]): {
  records: RecordData[];
  changed: RecordData[];
} {
  const workspace =
    records.length === 1 && records[0].kind === "workspace"
      ? records[0]
      : undefined;
  if (!workspace || workspace.fields?.[marker]) return { records, changed: [] };

  const plants = names.map(([key, name]) =>
    makeRecord("plant", workspace.id, {
      name,
      icon: key,
      iconVariant: defaultPlantIconVariant(key),
      defaultPlantKey: key,
      revision: 1,
    }),
  );
  const updatedWorkspace = {
    ...workspace,
    fields: { ...workspace.fields, [marker]: defaultPlantsVersion },
    revision: workspace.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  return {
    records: [updatedWorkspace, ...plants],
    changed: [updatedWorkspace, ...plants],
  };
}

/** A generated catalogue may be replaced by a complete backup without losing user data. */
export function isSeedOnlyWorkspace(records: RecordData[]) {
  const workspace = records.find((record) => record.kind === "workspace");
  return (
    !!workspace &&
    workspace.fields?.[marker] === defaultPlantsVersion &&
    workspace.revision >= 2 &&
    workspace.revision <= 3 &&
    !workspace.lastGardenId &&
    Object.keys(workspace.fields || {}).every((key) => key === marker) &&
    records.length === names.length + 1 &&
    records.every(
      (record) =>
        record.kind === "workspace" ||
        (record.kind === "plant" &&
          record.revision === 1 &&
          record.name === plantIcons[record.defaultPlantKey!] &&
          record.icon === record.defaultPlantKey &&
          !record.notes &&
          !record.color &&
          !record.fields &&
          record.iconVariant ===
            defaultPlantIconVariant(record.defaultPlantKey!)),
    )
  );
}
