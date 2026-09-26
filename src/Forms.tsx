import { useEffect, useState } from "react";
import { formatMeters } from "./format";
import { PlantIcon } from "./PlantIcon";
import { plantIcons, type PlantIconId } from "./plantAppearance";
import {
  addDays,
  categories,
  eventTypes,
  makeRecord,
  numberValue,
  today,
  vertices,
  type RecordData,
  type Change,
  type Geometry,
} from "./domain";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  meters = false,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  type?: string;
  meters?: boolean;
}) {
  const displayed =
    meters && typeof value === "number"
      ? formatMeters(value)
      : String(value ?? "");
  const [text, setText] = useState(displayed);
  useEffect(() => setText(displayed), [displayed]);
  const numeric = typeof value === "number";
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="form-control form-control-sm"
        type={type}
        value={numeric ? text : (value ?? "")}
        inputMode={numeric ? "decimal" : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (!numeric) onChange(e.target.value);
        }}
        onBlur={() => {
          if (!numeric) return;
          if (meters && text === displayed) return;
          const parsed = numberValue(text);
          const committed =
            meters && text.trim() && Number.isFinite(parsed)
              ? formatMeters(parsed)
              : text;
          setText(committed);
          onChange(committed);
        }}
      />
    </label>
  );
}
export function RecordForm({
  record,
  records,
  save,
  cancel,
  onDirty,
}: {
  record: RecordData;
  records: RecordData[];
  save: (changes: Change[], map?: boolean) => Promise<void>;
  cancel: () => void;
  onDirty: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState(record);
  const [move, setMove] = useState(false);
  const [moveDate, setMoveDate] = useState(today());
  const [error, setError] = useState("");
  const [alsoPlace, setAlsoPlace] = useState(false);
  const [placementStart, setPlacementStart] = useState("");
  const [placementObject, setPlacementObject] = useState("");
  const [placementGeometry, setPlacementGeometry] = useState<Geometry>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    shape: "rectangle",
  });
  const edit = (values: Partial<RecordData>) => {
    if (
      values.geometry &&
      draft.geometry?.shape === "polygon" &&
      values.geometry.shape === "polygon"
    ) {
      const previous = draft.geometry;
      if (
        values.geometry.width !== previous.width ||
        values.geometry.height !== previous.height
      ) {
        values.geometry.points = previous.points!.map((p) => ({
          x: (p.x * values.geometry!.width) / previous.width,
          y: (p.y * values.geometry!.height) / previous.height,
        }));
      } else if (
        values.geometry.points !== previous.points &&
        values.geometry.points?.length
      ) {
        values.geometry.width =
          Math.max(...values.geometry.points.map((p) => p.x)) -
          Math.min(...values.geometry.points.map((p) => p.x));
        values.geometry.height =
          Math.max(...values.geometry.points.map((p) => p.y)) -
          Math.min(...values.geometry.points.map((p) => p.y));
      }
    }
    setDraft({ ...draft, ...values });
    onDirty(true);
  };
  const geometry = draft.geometry;
  const placementPlanting =
    draft.kind === "placement"
      ? records.find((r) => r.id === draft.plantingId)
      : undefined;
  const field = (label: string, key: "name" | "notes") => (
    <Field
      label={label}
      value={draft[key]}
      onChange={(v) => edit({ [key]: v })}
    />
  );
  const submit = async () => {
    try {
      let changes: Change[];
      if (move) {
        if (!draft.startDate && !draft.unknownStart)
          throw Error("Startdatum saknas.");
        if (record.startDate && moveDate <= record.startDate)
          throw Error(
            "Flyttdatum måste ligga efter den tidigare placeringens start.",
          );
        if (record.endDate && moveDate >= record.endDate)
          throw Error("Flyttdatum måste ligga inom placeringens period.");
        changes = [
          { before: record, after: { ...record, endDate: moveDate } },
          {
            after: makeRecord("placement", draft.workspaceId, {
              ...draft,
              id: crypto.randomUUID(),
              revision: 0,
              startDate: moveDate,
              unknownStart: false,
            }),
          },
        ];
      } else
        changes = [
          { before: record.revision ? record : undefined, after: draft },
        ];
      if (
        alsoPlace &&
        draft.kind === "event" &&
        draft.eventType === "Utplantering"
      ) {
        const target = records.find((r) => r.id === draft.targetId);
        if (target?.kind !== "planting")
          throw Error(
            "Välj en plantering för att samtidigt skapa en kartplacering.",
          );
        changes.push({
          after: makeRecord("placement", draft.workspaceId, {
            gardenId: draft.gardenId,
            plantingId: target.id,
            name: target.name,
            layer: "actual",
            geometry: placementGeometry,
            startDate: placementStart || draft.date,
            objectId: placementObject || undefined,
          }),
        });
      }
      await save(
        changes,
        alsoPlace || ["object", "placement"].includes(record.kind),
      );
      onDirty(false);
      cancel();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <form
      onChangeCapture={() => onDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3>
        {move
          ? "Registrera fysisk flytt"
          : record.revision
            ? "Egenskaper"
            : "Skapa " +
              {
                garden: "trädgård",
                plant: "växt",
                object: "yta",
                event: "händelse",
                planting: "plantering",
                placement: "placering",
                workspace: "arbetsyta",
              }[record.kind]}
      </h3>
      {field("Namn", "name")}
      {["object", "placement", "plant", "planting"].includes(draft.kind) && (
        <fieldset className="appearance-fields">
          <legend>Utseende på kartan</legend>
          <label className="field">
            Figurfärg
            <input
              type="color"
              aria-label="Figurfärg"
              value={
                draft.color ||
                draft.snapshot?.color ||
                placementPlanting?.color ||
                placementPlanting?.snapshot?.color ||
                (draft.kind === "object" ? "#b8c79b" : "#6b9769")
              }
              onChange={(e) => edit({ color: e.target.value })}
            />
          </label>
          {draft.color && (
            <button type="button" onClick={() => edit({ color: undefined })}>
              Återställ standardfärg
            </button>
          )}
          {["plant", "planting"].includes(draft.kind) && (
            <>
              <p className="hint">
                Välj en växtikon. Nya planteringar får en kopia av växtens färg
                och ikon; befintliga ändras separat.
              </p>
              <div
                className="plant-icon-picker"
                role="group"
                aria-label="Växtikon"
              >
                <button
                  type="button"
                  aria-pressed={
                    (draft.icon ?? draft.snapshot?.icon ?? "none") === "none"
                  }
                  onClick={() => edit({ icon: "none" })}
                >
                  Ingen ikon
                </button>
                {(Object.entries(plantIcons) as [PlantIconId, string][]).map(
                  ([icon, label]) => (
                    <button
                      type="button"
                      key={icon}
                      aria-label={`Ikon: ${label}`}
                      aria-pressed={
                        (draft.icon ?? draft.snapshot?.icon) === icon
                      }
                      onClick={() => edit({ icon })}
                    >
                      <PlantIcon icon={icon} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ),
                )}
              </div>
            </>
          )}
        </fieldset>
      )}
      {draft.kind === "garden" && (
        <>
          <Field
            label="Bredd (m)"
            meters
            value={draft.width}
            onChange={(v) => edit({ width: numberValue(v) })}
          />
          <Field
            label="Höjd (m)"
            meters
            value={draft.height}
            onChange={(v) => edit({ height: numberValue(v) })}
          />
        </>
      )}
      {draft.kind === "object" && (
        <>
          <label className="field">
            Kategori
            <select
              className="form-select form-select-sm"
              value={draft.category}
              aria-label="Kategori"
              onChange={(e) => edit({ category: e.target.value })}
            >
              {categories.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!draft.locked}
              onChange={(e) => edit({ locked: e.target.checked })}
            />{" "}
            Lås objekt
          </label>
        </>
      )}
      {geometry && (
        <>
          <label className="field">
            Form
            <select
              value={geometry.shape}
              aria-label="Form"
              onChange={(e) =>
                edit({
                  geometry: {
                    ...geometry,
                    shape: e.target.value as typeof geometry.shape,
                    points:
                      e.target.value === "polygon"
                        ? vertices({ ...geometry, x: 0, y: 0, rotation: 0 })
                        : undefined,
                  },
                })
              }
            >
              <option value="rectangle">Rektangel</option>
              <option value="ellipse">Ellips / individ</option>
              <option value="polygon">Polygon / grupp</option>
            </select>
          </label>
          <p className="hint">
            {move
              ? "Ny plats från flyttdatum."
              : "Korrigera ritning: ändringen gäller hela den valda perioden."}
          </p>
          <div className="field-grid">
            {(["x", "y", "width", "height", "rotation"] as const).map(
              (key, i) => (
                <Field
                  key={key}
                  label={
                    ["X (m)", "Y (m)", "Bredd (m)", "Höjd (m)", "Rotation (°)"][
                      i
                    ]
                  }
                  value={geometry[key]}
                  meters={key !== "rotation"}
                  onChange={(v) =>
                    edit({ geometry: { ...geometry, [key]: numberValue(v) } })
                  }
                />
              ),
            )}
          </div>
          {geometry.shape === "polygon" && (
            <fieldset>
              <legend>Polygonens hörn (lokala meter)</legend>
              {geometry.points?.map((pt, i) => (
                <div className="vertex" key={i}>
                  <Field
                    label={`Hörn ${i + 1} X`}
                    meters
                    value={pt.x}
                    onChange={(v) =>
                      edit({
                        geometry: {
                          ...geometry,
                          points: geometry.points!.map((p, j) =>
                            j === i ? { ...p, x: numberValue(v) } : p,
                          ),
                        },
                      })
                    }
                  />
                  <Field
                    label={`Hörn ${i + 1} Y`}
                    meters
                    value={pt.y}
                    onChange={(v) =>
                      edit({
                        geometry: {
                          ...geometry,
                          points: geometry.points!.map((p, j) =>
                            j === i ? { ...p, y: numberValue(v) } : p,
                          ),
                        },
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Ta bort hörn ${i + 1}`}
                    onClick={() =>
                      edit({
                        geometry: {
                          ...geometry,
                          points: geometry.points!.filter((_, j) => j !== i),
                        },
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  edit({
                    geometry: {
                      ...geometry,
                      points: [
                        ...geometry.points!,
                        {
                          x:
                            (geometry.points![geometry.points!.length - 1].x +
                              geometry.points![0].x) /
                            2,
                          y:
                            (geometry.points![geometry.points!.length - 1].y +
                              geometry.points![0].y) /
                            2,
                        },
                      ],
                    },
                  })
                }
              >
                Lägg till hörn
              </button>
            </fieldset>
          )}
        </>
      )}
      {draft.kind === "placement" && (
        <>
          <label className="field">
            Bunden till yta
            <select
              className="form-select form-select-sm"
              value={draft.objectId || ""}
              aria-label="Bunden till yta"
              onChange={(e) => edit({ objectId: e.target.value || undefined })}
            >
              <option value="">Fritt i trädgården</option>
              {records
                .filter(
                  (r) => r.kind === "object" && r.gardenId === draft.gardenId,
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="hint">Bundna koordinater anges relativt ytan.</p>
          <label>
            <input
              type="checkbox"
              checked={!!draft.unknownStart}
              onChange={(e) =>
                edit({
                  unknownStart: e.target.checked,
                  startDate: e.target.checked ? undefined : today(),
                })
              }
            />{" "}
            Befintlig växt – startdatum okänt
          </label>
          {draft.unknownStart && (
            <p className="hint">
              Etableringsdatum saknas; visas även bakåt i tiden.
            </p>
          )}
        </>
      )}
      {["object", "placement"].includes(draft.kind) && (
        <>
          <Field
            label="Visas från"
            type="date"
            value={draft.startDate}
            onChange={(v) =>
              edit({ startDate: v || undefined, unknownStart: false })
            }
          />
          <Field
            label="Sista dagen på platsen"
            type="date"
            value={draft.endDate ? addDays(draft.endDate, -1) : ""}
            onChange={(v) => edit({ endDate: v ? addDays(v, 1) : undefined })}
          />
        </>
      )}
      {draft.kind === "planting" && (
        <>
          <Field
            label="Antal"
            value={draft.count}
            onChange={(v) => edit({ count: numberValue(v) })}
          />
          <p>Registrerad växt: {draft.snapshot?.name}</p>
          <details>
            <summary>Sparad katalogögonblicksbild</summary>
            {Object.entries(draft.snapshot?.fields || {}).map(([k, v]) => (
              <p key={k}>
                {k}: {v || "Okänt"}
              </p>
            ))}
          </details>
        </>
      )}
      {draft.kind === "plant" && (
        <>
          {[
            "Vetenskapligt namn",
            "Sortnamn",
            "Kategori",
            "Livslängd (ettårig/tvåårig/flerårig)",
            "Växtfamilj",
            "Såmetod",
            "Sådjup (cm)",
            "Plantavstånd (cm)",
            "Radavstånd (cm)",
            "Höjd (cm)",
            "Bredd (cm)",
            "Ljusbehov",
            "Jord och vatten",
            "Groning min (dagar)",
            "Groning max (dagar)",
            "Groning räknas från",
            "Skörd min (dagar)",
            "Skörd max (dagar)",
            "Skörd räknas från",
            "Källa",
            "Regional kontext",
          ].map((label) => (
            <Field
              key={label}
              label={label}
              value={draft.fields?.[label]}
              onChange={(v) =>
                edit({ fields: { ...draft.fields, [label]: v } })
              }
            />
          ))}
        </>
      )}
      {draft.kind === "event" && (
        <>
          <label className="field">
            Händelsetyp
            <select
              className="form-select"
              value={draft.eventType}
              aria-label="Händelsetyp"
              onChange={(e) => edit({ eventType: e.target.value })}
            >
              {eventTypes.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Field
            label="Händelsedatum"
            type="date"
            value={draft.date}
            onChange={(v) => edit({ date: v })}
          />
          <label className="field">
            Gäller
            <select
              className="form-select"
              value={draft.targetId}
              aria-label="Gäller"
              onChange={(e) => edit({ targetId: e.target.value })}
            >
              {records
                .filter(
                  (r) =>
                    r.id === draft.gardenId ||
                    (r.gardenId === draft.gardenId &&
                      ["object", "planting"].includes(r.kind)),
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          {draft.eventType === "Skörd" && (
            <>
              <Field
                label="Mängd (valfri)"
                value={draft.quantity}
                onChange={(v) =>
                  edit({ quantity: v ? numberValue(v) : undefined })
                }
              />
              <Field
                label="Enhet"
                value={draft.unit}
                onChange={(v) => edit({ unit: v })}
              />
            </>
          )}
          {draft.eventType === "Utplantering" && (
            <fieldset>
              <legend>Kartplacering</legend>
              <label>
                <input
                  type="checkbox"
                  checked={alsoPlace}
                  onChange={(e) => setAlsoPlace(e.target.checked)}
                />{" "}
                Skapa samtidigt en faktisk placering
              </label>
              {alsoPlace && (
                <>
                  <Field
                    label="Placeringen börjar"
                    type="date"
                    value={placementStart || draft.date}
                    onChange={setPlacementStart}
                  />
                  <label className="field">
                    Placeringens yta
                    <select
                      value={placementObject}
                      aria-label="Placeringens yta"
                      onChange={(e) => setPlacementObject(e.target.value)}
                    >
                      <option value="">Fritt i trädgården</option>
                      {records
                        .filter(
                          (r) =>
                            r.kind === "object" &&
                            r.gardenId === draft.gardenId &&
                            !r.archived,
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="hint">
                    Ange platsen i meter. Vid bindning är koordinaterna relativa
                    till ytan. Händelsen och placeringen sparas tillsammans när
                    du väljer Spara.
                  </p>
                  {(["x", "y", "width", "height"] as const).map((key, i) => (
                    <Field
                      key={key}
                      label={
                        [
                          "Placering X (m)",
                          "Placering Y (m)",
                          "Placering bredd (m)",
                          "Placering höjd (m)",
                        ][i]
                      }
                      value={placementGeometry[key]}
                      meters
                      onChange={(v) =>
                        setPlacementGeometry({
                          ...placementGeometry,
                          [key]: numberValue(v),
                        })
                      }
                    />
                  ))}
                </>
              )}
            </fieldset>
          )}
        </>
      )}
      <label className="field">
        Anteckningar
        <textarea
          className="form-control"
          value={draft.notes}
          onChange={(e) => edit({ notes: e.target.value })}
        />
      </label>
      {record.kind === "placement" && record.revision > 0 && (
        <>
          <label>
            <input
              type="checkbox"
              checked={move}
              onChange={(e) => setMove(e.target.checked)}
            />{" "}
            Registrera fysisk flytt
          </label>
          {move && (
            <Field
              label="Flyttdatum"
              type="date"
              value={moveDate}
              onChange={setMoveDate}
            />
          )}
        </>
      )}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="btn btn-primary" type="submit">
          Spara
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => {
            onDirty(false);
            cancel();
          }}
        >
          Avbryt
        </button>
        {record.revision > 0 && (
          <button
            type="button"
            onClick={async () => {
              try {
                await save(
                  [
                    {
                      before: record,
                      after: { ...record, archived: !record.archived },
                    },
                  ],
                  ["object", "placement"].includes(record.kind),
                );
                onDirty(false);
                cancel();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {record.archived ? "Återställ" : "Arkivera"}
          </button>
        )}
      </div>
    </form>
  );
}
