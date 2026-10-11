import type { RecordData } from "./domain";
import { plantGroups } from "./PlantOptions";

export function MixturePicker({
  records,
  selected,
  onChange,
}: {
  records: RecordData[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const groups = plantGroups(records);
  const sections = [
    {
      label: "Standardväxter",
      plants: groups.defaults,
    },
    {
      label: "Egna växter",
      plants: groups.custom,
    },
  ];
  const hasOptions = sections.some((section) => section.plants.length > 0);
  return (
    <fieldset className="mixture-picker">
      <legend>Växter i planteringen</legend>
      {!hasOptions && (
        <p className="hint">
          Skapa fler växter i växtregistret för att kunna blanda.
        </p>
      )}
      {sections
        .filter((section) => section.plants.length > 0)
        .map((section) => (
          <div role="group" aria-label={section.label} key={section.label}>
            <p className="section-label">{section.label}</p>
            {section.plants.map((plant) => (
              <label key={plant.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(plant.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, plant.id]
                        : selected.filter((id) => id !== plant.id),
                    )
                  }
                />{" "}
                {plant.name}
              </label>
            ))}
          </div>
        ))}
    </fieldset>
  );
}
