import type { RecordData } from "./domain";

export function MixturePicker({
  records,
  primaryId,
  selected,
  onChange,
}: {
  records: RecordData[];
  primaryId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const options = records.filter(
    (r) => r.kind === "plant" && r.id !== primaryId,
  );
  return (
    <fieldset className="mixture-picker">
      <legend>Fler växter i samma yta</legend>
      {options.length === 0 && (
        <p className="hint">
          Skapa fler växter i växtregistret för att kunna blanda.
        </p>
      )}
      {options.map((plant) => (
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
    </fieldset>
  );
}
