import type { RecordData } from "./domain";

export function plantGroups(records: RecordData[]) {
  const plants = records.filter((record) => record.kind === "plant");
  const sorted = (items: RecordData[]) =>
    items.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return {
    defaults: sorted(plants.filter((plant) => !!plant.defaultPlantKey)),
    custom: sorted(plants.filter((plant) => !plant.defaultPlantKey)),
  };
}

export function PlantSelectOptions({ records }: { records: RecordData[] }) {
  const { defaults, custom } = plantGroups(records);
  return (
    <>
      {defaults.length > 0 && (
        <optgroup label="Standardväxter">
          {defaults.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </optgroup>
      )}
      {custom.length > 0 && (
        <optgroup label="Egna växter">
          {custom.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
