import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes, useBlocker } from "react-router-dom";
import {
  FiMap,
  FiBookOpen,
  FiSettings,
  FiPlus,
  FiArrowLeft,
  FiArrowRight,
  FiDownload,
  FiSun,
} from "react-icons/fi";
import {
  active,
  addDays,
  eventTypes,
  makeRecord,
  shiftDate,
  today,
  transform,
  type Change,
  type Geometry,
  type RecordData,
  numberValue,
  plantingPlants,
} from "./domain";
import { gardenWarnings } from "./warnings";
import type { Repository } from "./repository";
import { GardenMap, type Tool } from "./Map";
import { Field, RecordForm } from "./Forms";
import { formatMeters } from "./format";
import { PlantIcon } from "./PlantIcon";
import { MixturePicker } from "./MixturePicker";
import { PlantSelectOptions } from "./PlantOptions";
import { deleteRecordChanges } from "./deleteRecord";

export function App({ repository }: { repository: Repository }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["records"],
    queryFn: () => repository.list(),
  });
  const records = query.data || [];
  const workspace = records.find((r) => r.kind === "workspace");
  const [gardenId, setGardenId] = useState("");
  const [date, setDate] = useState(today());
  const [selected, setSelected] = useState<string>();
  const [editor, setEditor] = useState<RecordData>();
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (confirm("Du har osparade ändringar. Vill du lämna dem?")) {
      setDirty(false);
      setEditor(undefined);
      setPlacementDraft(undefined);
      blocker.proceed();
    } else blocker.reset();
  }, [blocker]);
  const [tool, setTool] = useState<Tool>("select");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(true),
    [structure, setStructure] = useState(true),
    [plants, setPlants] = useState(true);
  const [plantId, setPlantId] = useState("");
  const [mixed, setMixed] = useState(false);
  const [mixtureIds, setMixtureIds] = useState<string[]>([]);
  const [mixtureName, setMixtureName] = useState("");
  const [count, setCount] = useState("1");
  const selectedPlants = [...new Set([plantId, ...(mixed ? mixtureIds : [])])]
    .map((id) => records.find((record) => record.id === id))
    .filter(
      (record): record is RecordData => !!record && record.kind === "plant",
    );
  const [edgeSnap, setEdgeSnap] = useState(true);
  const [pathWidth, setPathWidth] = useState(0.8);
  const [gridColumns, setGridColumns] = useState(1);
  const [gridRows, setGridRows] = useState(3);
  const [placementDraft, setPlacementDraft] = useState<Geometry>();
  const placementHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (placementDraft) placementHeading.current?.focus();
  }, [placementDraft]);
  const [plantingToPlace, setPlantingToPlace] = useState<string>();
  const [from, setFrom] = useState(date);
  const [last, setLast] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [bound, setBound] = useState("");
  const garden =
    records.find(
      (r) =>
        r.kind === "garden" && r.id === (gardenId || workspace?.lastGardenId),
    ) || records.find((r) => r.kind === "garden");
  const historyGardenId = garden?.id || gardenId || workspace?.lastGardenId;
  const chosen = records.find((r) => r.id === selected);
  const planting =
    chosen?.kind === "placement"
      ? records.find((r) => r.id === chosen.plantingId)
      : chosen?.kind === "planting"
        ? chosen
        : undefined;
  const mutation = useMutation({
    mutationFn: async ({
      changes,
      map,
    }: {
      changes: Change[];
      map?: boolean;
    }) => repository.commit(changes, map ? garden?.id : undefined),
    onMutate: () => {
      setStatus("Sparar lokalt");
      setError("");
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["records"] });
      setStatus("Sparat lokalt");
    },
    onError: (e) => {
      setStatus("Kunde inte spara");
      setError(e.message);
    },
  });
  const save = async (changes: Change[], map = false) => {
    const newGarden = changes.find(
      (c) => !c.before && c.after?.kind === "garden",
    )?.after;
    const committed =
      newGarden && workspace
        ? [
            ...changes,
            {
              before: workspace,
              after: { ...workspace, lastGardenId: newGarden.id },
            },
          ]
        : changes;
    await mutation.mutateAsync({ changes: committed, map });
    if (newGarden) setGardenId(newGarden.id);
  };
  useEffect(() => {
    setGrid(workspace?.fields?.grid !== "false");
    setSnap(workspace?.fields?.snap !== "false");
    setEdgeSnap(workspace?.fields?.edgeSnap !== "false");
    setStructure(workspace?.fields?.structure !== "false");
    setPlants(workspace?.fields?.plants !== "false");
  }, [workspace?.fields]);
  useEffect(
    () =>
      repository.subscribe(() => {
        void cache.invalidateQueries({ queryKey: ["records"] });
      }),
    [repository, cache],
  );
  useEffect(() => {
    const focus = () => {
      void cache.invalidateQueries({ queryKey: ["records"] });
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [cache]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === "Escape") {
        setTool("select");
        setPlacementDraft(undefined);
        if (placementDraft) setDirty(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && historyGardenId) {
        e.preventDefault();
        void action(() =>
          repository.travel(historyGardenId, e.shiftKey ? "redo" : "undo"),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function action(fn: () => Promise<unknown>) {
    setError("");
    setStatus("Sparar lokalt");
    try {
      await fn();
      await cache.invalidateQueries({ queryKey: ["records"] });
      setStatus("Sparat lokalt");
    } catch (e) {
      setError((e as Error).message);
      setStatus("Kunde inte spara");
    }
  }
  async function remove(record: RecordData) {
    if (!confirm(`Ta bort ${record.name || "posten"}? Åtgärden kan ångras.`))
      return;
    try {
      await save(deleteRecordChanges(record, records), true);
      setSelected(undefined);
      setEditor(undefined);
      setDirty(false);
      setTool("select");
    } catch (e) {
      setError((e as Error).message);
      setStatus("Kunde inte spara");
    }
  }
  function edit(r: RecordData) {
    if (dirty && !confirm("Du har osparade ändringar. Vill du lämna dem?"))
      return;
    setEditor({ ...r });
    setPlacementDraft(undefined);
    setDirty(false);
    setSelected(r.id);
  }
  function select(id: string) {
    if (dirty && !confirm("Du har osparade ändringar. Vill du lämna dem?"))
      return false;
    setSelected(id);
    setEditor(undefined);
    setPlacementDraft(undefined);
    setDirty(false);
    return true;
  }
  function create(kind: RecordData["kind"]) {
    if (!workspace) return;
    edit(
      makeRecord(kind, workspace.id, {
        gardenId:
          kind === "garden" || kind === "plant" ? undefined : garden?.id,
        ...(kind === "garden"
          ? {
              name: "Min trädgård",
              width: 20,
              height: 15,
              timezone: "Europe/Stockholm",
            }
          : kind === "event"
            ? {
                date,
                eventType: "Anteckning",
                targetId:
                  planting?.id ||
                  (chosen?.kind === "object" ? chosen.id : garden?.id),
              }
            : {}),
      }),
    );
  }
  async function createGeometry(g: Geometry) {
    if (!garden || !workspace) return;
    if (tool === "planting") {
      if (
        editor &&
        dirty &&
        !confirm("Du har osparade ändringar. Vill du lämna dem?")
      )
        return;
      setEditor(undefined);
      setPlacementDraft(g);
      setDirty(true);
      setFrom(date);
      return;
    }
    const record = makeRecord(
      tool === "plantGrid" ? "plantGrid" : "object",
      workspace.id,
      {
        gardenId: garden.id,
        name:
          tool === "plantGrid"
            ? `Växtrutnät ${gridColumns}×${gridRows}`
            : tool === "path"
              ? "Ny gång"
              : "Ny odlingsyta",
        ...(tool === "plantGrid"
          ? {
              columns: gridColumns,
              rows: gridRows,
              cellPlantIds: Array<string | null>(gridColumns * gridRows).fill(
                null,
              ),
            }
          : {}),
        category: tool === "path" ? "Gång" : "Odlingsland",
        ...(tool === "path" ? { color: "#d1b899" } : {}),
        geometry: g,
      },
    );
    try {
      await save([{ after: record }], true);
      setSelected(record.id);
    } catch {
      setEditor(record);
      setDirty(true);
    }
    setTool("select");
  }
  async function addPlanting() {
    if (!garden || !workspace || !placementDraft) return;
    const [plant, ...companions] = selectedPlants;
    const existing = records.find((r) => r.id === plantingToPlace);
    if (!existing && mixed && selectedPlants.length < 2) {
      setError("Välj minst två olika växter för en blandad plantering.");
      return;
    }
    if (!plant && !existing) {
      setError("Välj eller skapa en växt först.");
      return;
    }
    const p =
      existing ||
      makeRecord("planting", workspace.id, {
        gardenId: garden.id,
        plantId: plant!.id,
        name: mixed
          ? mixtureName.trim() ||
            [plant!, ...companions].map((r) => r.name).join(" + ")
          : plant!.name,
        count: Number(count.replace(",", ".")),
        snapshot: structuredClone(plant!),
        ...(mixed ? { additionalPlants: structuredClone(companions) } : {}),
      });
    const parent = records.find((r) => r.id === bound)?.geometry;
    const localGeometry = parent
      ? {
          ...placementDraft,
          ...transform(placementDraft, parent, true),
          rotation: placementDraft.rotation - parent.rotation,
        }
      : placementDraft;
    const placement = makeRecord("placement", workspace.id, {
      gardenId: garden.id,
      plantingId: p.id,
      name: p.name,
      layer: "actual",
      geometry: localGeometry,
      startDate: unknown ? undefined : from,
      endDate: last ? addDays(last, 1) : undefined,
      unknownStart: unknown,
      objectId: bound || undefined,
    });
    try {
      await save(
        [...(existing ? [] : [{ after: p }]), { after: placement }],
        true,
      );
      setPlacementDraft(undefined);
      setDirty(false);
      setPlantingToPlace(undefined);
      setTool("select");
      setSelected(placement.id);
      setDate(placement.startDate || date);
    } catch {
      /* Form stays open. */
    }
  }
  async function download(all: boolean) {
    try {
      const snapshot = await repository.export(all ? undefined : garden?.id);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `odlingskartan-${all ? "backup" : "trädgård"}-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const warnings = useMemo(
    () => gardenWarnings(records, garden?.id, date),
    [records, garden?.id, date],
  );
  if (query.isPending)
    return <main className="loading">Öppnar din lokala arbetsyta…</main>;
  if (query.error)
    return (
      <main className="loading">
        <h1>Arbetsytan kunde inte öppnas</h1>
        <p role="alert">{query.error.message}</p>
        <button onClick={() => void query.refetch()}>Försök igen</button>
      </main>
    );
  return (
    <>
      <header className="topbar">
        <NavLink className="brand" to="/">
          <span className="brand-icon">
            <FiSun />
          </span>
          odlingskartan<span className="tag">DIN TRÄDGÅRD, ÖVER TID</span>
        </NavLink>
        <nav>
          <NavLink to="/">
            <FiMap /> Kartan
          </NavLink>
          <NavLink to="/journal">
            <FiBookOpen /> Journal
          </NavLink>
          <NavLink to="/installningar">
            <FiSettings /> Lagring
          </NavLink>
        </nav>
        <span className="save-status" role="status">
          {status || "Lokal arbetsyta"}
        </span>
      </header>
      <div className="privacy">
        Data sparas bara i den här webbläsaren{" "}
        <button onClick={() => void download(true)}>
          <FiDownload /> Säkerhetskopiera allt
        </button>
      </div>
      {error && (
        <div role="alert" className="alert alert-danger global-error">
          {error}
          <button onClick={() => setError("")} aria-label="Stäng felmeddelande">
            ×
          </button>
        </div>
      )}
      <div className="garden-bar">
        <div>
          <span className="eyebrow">MIN ODLINGSPLATS</span>
          <select
            aria-label="Välj trädgård"
            value={garden?.id || ""}
            onChange={(e) => {
              if (
                dirty &&
                !confirm("Du har osparade ändringar. Vill du lämna dem?")
              )
                return;
              setGardenId(e.target.value);
              setPlacementDraft(undefined);
              setPlantingToPlace(undefined);
              setDirty(false);
              setSelected(undefined);
              setEditor(undefined);
              if (workspace)
                void action(() =>
                  save([
                    {
                      before: workspace,
                      after: { ...workspace, lastGardenId: e.target.value },
                    },
                  ]),
                );
            }}
          >
            <option value="" disabled>
              Välj trädgård
            </option>
            {records
              .filter((r) => r.kind === "garden")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>
        <div className="actions">
          <button onClick={() => create("garden")}>
            <FiPlus /> Ny trädgård
          </button>
          {garden && (
            <button onClick={() => edit(garden)}>Trädgårdens egenskaper</button>
          )}
        </div>
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <div className="workspace">
              <aside className="left-panel">
                <h2>Rita & odla</h2>
                <p className="hint">Ge dina odlingar en plats.</p>
                <div className="tools">
                  {(
                    [
                      ["select", "Välj"],
                      ["move", "Flytta"],
                      ["pan", "Panorera"],
                      ["rectangle", "Rektangel"],
                      ["ellipse", "Ellips"],
                      ["path", "Gång"],
                      ["plantGrid", "Växtrutnät"],
                      ["planting", "Plantera"],
                    ] as [Tool, string][]
                  ).map(([t, label]) => (
                    <button
                      className={tool === t ? "active" : ""}
                      aria-pressed={tool === t}
                      key={t}
                      onClick={() => {
                        if (
                          dirty &&
                          !confirm(
                            "Du har osparade ändringar. Vill du lämna dem?",
                          )
                        )
                          return;
                        setEditor(undefined);
                        setPlacementDraft(undefined);
                        setDirty(false);
                        if (t !== tool) setSelected(undefined);
                        setTool(t);
                        setPlantingToPlace(undefined);
                        if (t === "planting" && chosen?.kind === "plant")
                          setPlantId(chosen.id);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {tool === "path" && (
                  <div className="plant-picker">
                    <Field
                      label="Gångbredd (m)"
                      meters
                      value={pathWidth}
                      onChange={(v) => {
                        const n = numberValue(v);
                        if (Number.isFinite(n) && n >= 0.1) setPathWidth(n);
                        else
                          setError("Gångbredden måste vara minst 0,1 meter.");
                      }}
                    />
                    <p className="hint">
                      Dra gångens mittlinje genom landet. Gången läggs ovanpå
                      landet utan att dela eller radera det.
                    </p>
                  </div>
                )}
                {tool === "plantGrid" && (
                  <div className="plant-picker">
                    <div className="field-grid">
                      <label className="field">
                        Kolumner
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={gridColumns}
                          onChange={(e) =>
                            setGridColumns(
                              Math.max(
                                1,
                                Math.min(20, Number(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        Rader
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={gridRows}
                          onChange={(e) =>
                            setGridRows(
                              Math.max(
                                1,
                                Math.min(20, Number(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <p className="hint">
                      Dra upp rutnätet på kartan. Välj sedan växt i varje cell
                      under Redigera egenskaper.
                    </p>
                  </div>
                )}
                {tool === "planting" && (
                  <div className="plant-picker">
                    <label className="field">
                      {mixed ? "Första växt (valfritt)" : "Växt"}
                      <select
                        aria-label="Växt att plantera"
                        value={plantId}
                        onChange={(e) => {
                          setPlantId(e.target.value);
                          setMixtureIds((ids) =>
                            ids.filter((id) => id !== e.target.value),
                          );
                        }}
                      >
                        <option value="">Välj en växt</option>
                        <PlantSelectOptions records={records} />
                      </select>
                    </label>
                    {!plantingToPlace && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={mixed}
                            onChange={(e) => setMixed(e.target.checked)}
                          />{" "}
                          Blandad plantering
                        </label>
                        {mixed && (
                          <>
                            <Field
                              label="Blandningens namn"
                              value={mixtureName}
                              onChange={setMixtureName}
                            />
                            <MixturePicker
                              records={records}
                              primaryId={plantId}
                              selected={mixtureIds}
                              onChange={setMixtureIds}
                            />
                            <p className="hint">
                              Kryssa i minst två växter. Du kan också välja en
                              första växt i rullistan, men det är valfritt.
                              Antalet gäller hela blandningen; alla växter delar
                              yta och datum.
                            </p>
                          </>
                        )}
                      </>
                    )}
                    <Field
                      label="Antal plantor"
                      value={count}
                      onChange={setCount}
                    />
                    <p className="hint">
                      Välj en växt och klicka eller dra i kartan. Bekräfta sedan
                      med Spara plantering.
                    </p>
                  </div>
                )}
                <button className="wide" onClick={() => create("plant")}>
                  <FiPlus /> Skapa egen växt
                </button>
                <h3 className="section-label">LAGER</h3>
                {[
                  ["Rutnät", grid, setGrid],
                  ["Snäppning", snap, setSnap],
                  ["Struktur", structure, setStructure],
                  ["Planteringar", plants, setPlants],
                  ["Snäpp mot odlingar", edgeSnap, setEdgeSnap],
                ].map(([label, value, set], index) => (
                  <label className="toggle" key={label as string}>
                    <input
                      type="checkbox"
                      checked={value as boolean}
                      onChange={(e) => {
                        (set as (v: boolean) => void)(e.target.checked);
                        if (workspace)
                          void action(() =>
                            save([
                              {
                                before: workspace,
                                after: {
                                  ...workspace,
                                  fields: {
                                    ...workspace.fields,
                                    [[
                                      "grid",
                                      "snap",
                                      "structure",
                                      "plants",
                                      "edgeSnap",
                                    ][index]]: String(e.target.checked),
                                  },
                                },
                              },
                            ]),
                          );
                      }}
                    />
                    {label as string}
                  </label>
                ))}
                <h3 className="section-label">OBJEKT & VÄXTER</h3>
                <input
                  className="form-control form-control-sm"
                  aria-label="Sök objekt och växter"
                  placeholder="Sök i trädgården…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="object-list">
                  {records
                    .filter(
                      (r) =>
                        (r.gardenId === garden?.id || r.kind === "plant") &&
                        ["object", "plantGrid", "planting", "plant"].includes(
                          r.kind,
                        ) &&
                        [
                          r.name,
                          ...plantingPlants(r).map((plant) => plant.name),
                        ]
                          .join(" ")
                          .toLocaleLowerCase()
                          .includes(search.toLocaleLowerCase()),
                    )
                    .sort((a, b) => {
                      const order = (record: RecordData) =>
                        record.kind === "plant"
                          ? record.defaultPlantKey
                            ? 2
                            : 1
                          : 0;
                      return (
                        order(a) - order(b) ||
                        a.name.localeCompare(b.name, "sv")
                      );
                    })
                    .map((r) => (
                      <button
                        key={r.id}
                        className={selected === r.id ? "active" : ""}
                        onClick={() => {
                          select(r.id);
                        }}
                      >
                        <span>
                          {(r.icon ?? r.snapshot?.icon) &&
                          (r.icon ?? r.snapshot?.icon) !== "none" ? (
                            <PlantIcon
                              icon={
                                (r.icon ?? r.snapshot?.icon) as Exclude<
                                  RecordData["icon"],
                                  undefined | "none"
                                >
                              }
                              variant={
                                r.icon !== undefined
                                  ? r.iconVariant
                                  : r.snapshot?.iconVariant
                              }
                            />
                          ) : r.kind === "plant" ? (
                            "♧"
                          ) : r.kind === "planting" ? (
                            "●"
                          ) : (
                            "▱"
                          )}
                        </span>
                        <span>
                          {r.name}
                          <small>
                            {r.kind === "plant"
                              ? r.defaultPlantKey
                                ? "Standardväxt"
                                : "Egen växt"
                              : r.kind === "plantGrid"
                                ? `${r.columns}×${r.rows} rutnät`
                                : r.kind === "planting"
                                  ? `${r.count} planta/plantor`
                                  : r.category}
                          </small>
                        </span>
                      </button>
                    ))}
                </div>
              </aside>
              <main className="map-area">
                <div className="map-heading">
                  <div>
                    <h1>{garden?.name || "Här börjar din trädgård"}</h1>
                    <p>
                      {garden
                        ? `${formatMeters(garden.width!)} × ${formatMeters(garden.height!)} meter · faktisk odlingshistorik`
                        : "Skapa en trädgård och rita din första odlingsyta."}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      disabled={!historyGardenId}
                      aria-label="Ångra"
                      onClick={() =>
                        historyGardenId &&
                        void action(() =>
                          repository.travel(historyGardenId, "undo"),
                        )
                      }
                    >
                      <FiArrowLeft /> Ångra
                    </button>
                    <button
                      disabled={!historyGardenId}
                      aria-label="Gör om"
                      onClick={() =>
                        historyGardenId &&
                        void action(() =>
                          repository.travel(historyGardenId, "redo"),
                        )
                      }
                    >
                      Gör om <FiArrowRight />
                    </button>
                  </div>
                </div>
                {garden ? (
                  <GardenMap
                    key={garden.id}
                    garden={garden}
                    records={records}
                    date={date}
                    selected={selected}
                    tool={tool}
                    grid={grid}
                    snap={snap}
                    edgeSnap={edgeSnap}
                    structure={structure}
                    plants={plants}
                    onSelect={(id) => {
                      return select(id);
                    }}
                    onCreate={createGeometry}
                    placementDraft={placementDraft}
                    pathWidth={pathWidth}
                    onMove={async (r, g) => {
                      try {
                        await save(
                          [{ before: r, after: { ...r, geometry: g } }],
                          true,
                        );
                      } catch {
                        setEditor({ ...r, geometry: g });
                        setDirty(true);
                      }
                    }}
                    onMoveMany={async (changes) => {
                      try {
                        await save(changes, true);
                        return true;
                      } catch {
                        return false;
                      }
                    }}
                    onCancel={() => setTool("select")}
                  />
                ) : (
                  <div className="empty-map">
                    <FiMap size={64} />
                    <h2>En plats för det som växer</h2>
                    <p>
                      Rita dina odlingsytor, placera växter och följ dem över
                      tid.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => create("garden")}
                    >
                      Skapa din första trädgård
                    </button>
                  </div>
                )}
                <div className="timeline">
                  <div>
                    <span className="eyebrow">VISA TRÄDGÅRDEN DEN</span>
                    <input
                      aria-label="Kartdatum"
                      type="date"
                      value={date}
                      onChange={(e) =>
                        e.target.value && setDate(e.target.value)
                      }
                    />
                  </div>
                  <div className="date-buttons">
                    {[-12, -1].map((n) => (
                      <button
                        key={n}
                        onClick={() => setDate(shiftDate(date, n))}
                      >
                        {n === -12 ? "− år" : "− månad"}
                      </button>
                    ))}
                    <button onClick={() => setDate(addDays(date, -1))}>
                      − dag
                    </button>
                    <button onClick={() => setDate(today())}>Idag</button>
                    <button onClick={() => setDate(addDays(date, 1))}>
                      + dag
                    </button>
                    {[1, 12].map((n) => (
                      <button
                        key={n}
                        onClick={() => setDate(shiftDate(date, n))}
                      >
                        {n === 12 ? "+ år" : "+ månad"}
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label="Tidsreglage"
                    type="range"
                    min="0"
                    max={
                      Math.round(
                        (Date.parse(`${Number(date.slice(0, 4)) + 1}-01-01`) -
                          Date.parse(date.slice(0, 4) + "-01-01")) /
                          86400000,
                      ) - 1
                    }
                    value={Math.max(
                      0,
                      Math.round(
                        (Date.parse(date) -
                          Date.parse(date.slice(0, 4) + "-01-01")) /
                          86400000,
                      ),
                    )}
                    onChange={(e) =>
                      setDate(
                        addDays(
                          date.slice(0, 4) + "-01-01",
                          Number(e.target.value),
                        ),
                      )
                    }
                  />
                </div>
                {warnings.length > 0 && (
                  <details className="warnings">
                    <summary>{warnings.length} geometriska varningar</summary>
                    {warnings.slice(0, 50).map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </details>
                )}
              </main>
              <aside className="right-panel">
                {editor ? (
                  <RecordForm
                    key={editor.id}
                    record={editor}
                    records={records}
                    save={save}
                    onDirty={setDirty}
                    onDelete={remove}
                    cancel={() => setEditor(undefined)}
                  />
                ) : placementDraft ? (
                  <>
                    <h3 ref={placementHeading} tabIndex={-1}>
                      Registrera placering
                    </h3>
                    <p>
                      Den streckade ytan är inte sparad ännu. Kontrollera
                      datumen och välj Spara plantering.
                    </p>
                    {!mixed &&
                      selectedPlants.length === 0 &&
                      !plantingToPlace && (
                        <p role="alert">
                          Välj en standardväxt eller egen växt under Plantera.
                          Saknas växten, avbryt och välj Skapa egen växt först.
                        </p>
                      )}
                    <Field
                      label="Visas från"
                      value={from}
                      type="date"
                      onChange={setFrom}
                    />
                    <Field
                      label="Sista dagen på platsen"
                      value={last}
                      type="date"
                      onChange={setLast}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={unknown}
                        onChange={(e) => setUnknown(e.target.checked)}
                      />{" "}
                      Befintlig växt – startdatum okänt
                    </label>
                    <label className="field">
                      Bunden till yta
                      <select
                        value={bound}
                        aria-label="Bunden till yta"
                        onChange={(e) => setBound(e.target.value)}
                      >
                        <option value="">Fritt i trädgården</option>
                        {records
                          .filter(
                            (r) =>
                              r.kind === "object" && r.gardenId === garden?.id,
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <p className="hint">
                      Platsen följer med om den bundna ytan flyttas eller
                      roteras.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => void addPlanting()}
                    >
                      Spara plantering
                    </button>
                    <button
                      onClick={() => {
                        setPlacementDraft(undefined);
                        setDirty(false);
                      }}
                    >
                      Avbryt
                    </button>
                  </>
                ) : chosen ? (
                  <>
                    <span className="eyebrow">VALT OBJEKT</span>
                    <h2>{chosen.name}</h2>
                    {chosen.kind === "plant" && (
                      <p className="hint">
                        {chosen.defaultPlantKey ? "Standardväxt" : "Egen växt"}
                      </p>
                    )}
                    <p>{chosen.notes || "Inga anteckningar ännu."}</p>
                    {chosen.geometry && (
                      <p>
                        {formatMeters(chosen.geometry.width)} ×{" "}
                        {formatMeters(chosen.geometry.height)} m
                      </p>
                    )}
                    {planting && (
                      <p>
                        {planting.count} planta/plantor ·{" "}
                        {plantingPlants(planting)
                          .map((plant) => plant.name)
                          .join(", ")}
                      </p>
                    )}
                    {chosen.unknownStart && <p>Etableringsdatum saknas.</p>}
                    <div className="stack">
                      {chosen.geometry && (
                        <>
                          <button
                            disabled={!!chosen.locked}
                            aria-pressed={tool === "resize"}
                            onClick={() =>
                              setTool(tool === "resize" ? "select" : "resize")
                            }
                          >
                            {tool === "resize"
                              ? "Avsluta storleksändring"
                              : "Ändra storlek"}
                          </button>
                          {tool === "resize" && (
                            <p className="hint">
                              Dra i ett hörn på kartan. Släpp för att spara.
                              Escape avbryter dragningen. Bundna plantor
                              behåller sina mått och avstånd.
                            </p>
                          )}
                        </>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => edit(chosen)}
                      >
                        Redigera egenskaper
                      </button>
                      {chosen.kind !== "workspace" && (
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => void remove(chosen)}
                        >
                          Ta bort
                        </button>
                      )}
                      {planting && chosen.kind === "placement" && (
                        <button onClick={() => edit(planting)}>
                          Redigera plantering och antal
                        </button>
                      )}
                      {chosen.kind === "planting" && (
                        <button
                          onClick={() => {
                            setPlantingToPlace(chosen.id);
                            setTool("planting");
                          }}
                        >
                          Lägg till placering
                        </button>
                      )}
                      {chosen.kind === "plant" && (
                        <button
                          onClick={() =>
                            edit(
                              makeRecord("planting", workspace!.id, {
                                gardenId: garden?.id,
                                plantId: chosen.id,
                                name: chosen.name,
                                count: 1,
                                snapshot: structuredClone(chosen),
                              }),
                            )
                          }
                          disabled={!garden}
                        >
                          Ny odlingsomgång utan placering
                        </button>
                      )}
                      <button onClick={() => create("event")}>
                        Registrera journalhändelse
                      </button>
                      {chosen.kind === "object" && (
                        <button
                          onClick={() =>
                            void action(() =>
                              save(
                                [
                                  {
                                    after: makeRecord("object", workspace!.id, {
                                      ...chosen,
                                      id: crypto.randomUUID(),
                                      revision: 0,
                                      name: chosen.name + " (kopia)",
                                      geometry: {
                                        ...chosen.geometry!,
                                        x: chosen.geometry!.x + 1,
                                      },
                                    }),
                                  },
                                ],
                                true,
                              ),
                            )
                          }
                        >
                          Duplicera tom yta
                        </button>
                      )}
                    </div>
                    {planting && (
                      <>
                        <h3>Placeringar</h3>
                        {records
                          .filter(
                            (r) =>
                              r.kind === "placement" &&
                              r.plantingId === planting.id,
                          )
                          .map((r) => (
                            <button
                              className="history-item"
                              key={r.id}
                              onClick={() => edit(r)}
                            >
                              {r.startDate || "Okänd start"} →{" "}
                              {r.endDate
                                ? addDays(r.endDate, -1)
                                : "tills vidare"}
                            </button>
                          ))}
                      </>
                    )}
                    <h3>Journal</h3>
                    {records
                      .filter(
                        (r) =>
                          r.kind === "event" &&
                          r.targetId === (planting?.id || chosen.id),
                      )
                      .sort((a, b) => b.date!.localeCompare(a.date!))
                      .map((r) => (
                        <button
                          className="history-item"
                          key={r.id}
                          onClick={() => edit(r)}
                        >
                          {r.date} · {r.eventType}
                          <small>{r.notes}</small>
                        </button>
                      ))}
                  </>
                ) : (
                  <div className="inspector-empty">
                    <FiSun size={36} />
                    <h3>Allt har sin plats</h3>
                    <p>
                      Välj en yta eller plantering i kartan för att se dess
                      mått, datum och berättelse.
                    </p>
                    <hr />
                    <p className="hint">
                      En växtpost är en sort. En plantering är din
                      odlingsomgång. Placeringen visar var den finns under en
                      viss period.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          }
        />
        <Route
          path="/journal"
          element={
            <div className="page">
              <Journal
                records={records}
                garden={garden}
                date={date}
                setDate={setDate}
                onEdit={edit}
                onCreate={() => create("event")}
              />
              {editor && (
                <div className="journal-editor">
                  <RecordForm
                    key={editor.id}
                    record={editor}
                    records={records}
                    save={save}
                    onDelete={remove}
                    cancel={() => setEditor(undefined)}
                    onDirty={setDirty}
                  />
                </div>
              )}
            </div>
          }
        />
        <Route
          path="/installningar"
          element={
            <Storage
              onExport={download}
              onImport={(value, replaceWorkspace) =>
                action(() => repository.import(value, { replaceWorkspace }))
              }
              garden={!!garden}
            />
          }
        />
      </Routes>
    </>
  );
}
function Journal({
  records,
  garden,
  date,
  setDate,
  onEdit,
  onCreate,
}: {
  records: RecordData[];
  garden?: RecordData;
  date: string;
  setDate: (s: string) => void;
  onEdit: (r: RecordData) => void;
  onCreate: () => void;
}) {
  const [type, setType] = useState(""),
    [plant, setPlant] = useState(""),
    [area, setArea] = useState("");
  const events = records
    .filter(
      (r) =>
        r.kind === "event" &&
        r.gardenId === garden?.id &&
        (!type || r.eventType === type) &&
        (!plant ||
          plantingPlants(records.find((p) => p.id === r.targetId)).some(
            (p) => p.id === plant,
          )) &&
        (!area ||
          r.targetId === area ||
          records.some(
            (p) =>
              p.kind === "placement" &&
              p.plantingId === r.targetId &&
              p.objectId === area &&
              active(p, r.date!),
          )),
    )
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const month = date.slice(0, 7),
    first = month + "-01",
    offset = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DET SOM FAKTISKT HÄNDER</span>
          <h1>Odlingsjournal</h1>
        </div>
        <button
          className="btn btn-primary"
          disabled={!garden}
          onClick={onCreate}
        >
          Ny journalhändelse
        </button>
      </div>
      <div className="filters">
        <label>
          Händelsetyp
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Alla händelser</option>
            {eventTypes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Växt
          <select value={plant} onChange={(e) => setPlant(e.target.value)}>
            <option value="">Alla växter</option>
            <PlantSelectOptions records={records} />
          </select>
        </label>
        <label>
          Odlingsyta
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Alla ytor</option>
            {records
              .filter((r) => r.kind === "object" && r.gardenId === garden?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <Field
          label="Månad"
          type="month"
          value={month}
          onChange={(v) => v && setDate(v + "-01")}
        />
      </div>
      <div className="calendar">
        {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
          <strong key={d}>{d}</strong>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const day = addDays(first, i - offset);
          return (
            <div key={day} className={day.startsWith(month) ? "" : "muted"}>
              <span>{Number(day.slice(-2))}</span>
              {events
                .filter((r) => r.date === day)
                .map((r) => (
                  <button key={r.id} onClick={() => onEdit(r)}>
                    {r.eventType} ·{" "}
                    {records.find((p) => p.id === r.targetId)?.name}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      <h2>Kronologisk lista</h2>
      {events.length === 0 ? (
        <p>Inga registrerade händelser ännu.</p>
      ) : (
        events.map((r) => (
          <button className="journal-row" key={r.id} onClick={() => onEdit(r)}>
            <time>{r.date}</time>
            <strong>{r.eventType}</strong>
            <span>{records.find((p) => p.id === r.targetId)?.name}</span>
            <span>
              {r.notes}{" "}
              {r.quantity !== undefined ? `${r.quantity} ${r.unit || ""}` : ""}
            </span>
          </button>
        ))
      )}
    </>
  );
}
function Storage({
  onExport,
  onImport,
  garden,
}: {
  onExport: (all: boolean) => Promise<void>;
  onImport: (value: unknown, replaceWorkspace?: boolean) => Promise<void>;
  garden: boolean;
}) {
  const [result, setResult] = useState(
      "Beständig lagring har inte kontrollerats.",
    ),
    [error, setError] = useState("");
  const [replaceWorkspace, setReplaceWorkspace] = useState(false);
  useEffect(() => {
    if (navigator.storage?.persisted)
      void navigator.storage
        .persisted()
        .then((v) =>
          setResult(
            v
              ? "Beständig lagring är beviljad. En backup behövs ändå."
              : "Lagring kan rensas automatiskt. Säkerhetskopiera regelbundet.",
          ),
        );
    else setResult("Webbläsaren saknar stöd för beständig lagring.");
  }, []);
  return (
    <main className="page storage-page">
      <span className="eyebrow">DIN DATA, HOS DIG</span>
      <h1>Lokal lagring & säkerhetskopior</h1>
      <p>
        Data sparas bara i den här webbläsaren. Profil, protokoll, värdnamn och
        port bestämmer vilken arbetsyta du ser. En annan enhet eller URL får en
        separat arbetsyta.
      </p>
      <section>
        <h2>Säkerhetskopiera och flytta</h2>
        <p>
          Backup bevarar alla ID:n och återställs i en tom arbetsyta. Du kan
          också välja att ersätta hela den nuvarande arbetsytan efter
          bekräftelse. Trädgårdsimport skapar en kopia med nya ID:n. Hela
          växtregistret ingår.
        </p>
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => void onExport(true)}
          >
            Säkerhetskopiera allt
          </button>
          <button disabled={!garden} onClick={() => void onExport(false)}>
            Exportera trädgård
          </button>
        </div>
        <label className="field">
          <input
            type="checkbox"
            checked={replaceWorkspace}
            onChange={(e) => setReplaceWorkspace(e.target.checked)}
          />{" "}
          Ersätt nuvarande arbetsyta med en full backup
        </label>
        <label className="field">
          Importera trädgård som kopia / återställ arbetsytebackup (JSON, högst
          20 MB)
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              try {
                setError("");
                if (file.size > 20 * 1024 * 1024)
                  throw Error("Filen får vara högst 20 MB.");
                const value = JSON.parse(await file.text());
                if (replaceWorkspace) {
                  if (value?.exportKind !== "workspace")
                    throw Error("För att ersätta arbetsytan krävs en full backup.");
                  if (
                    !confirm(
                      "Detta ersätter all data i den här arbetsytan, inklusive trädgårdar och ångerhistorik. Har du sparat en backup av nuvarande läge?",
                    )
                  )
                    return;
                }
                await onImport(value, replaceWorkspace);
                setReplaceWorkspace(false);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                input.value = "";
              }
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
      </section>
      <section>
        <h2>Skydd för lokal data</h2>
        <p role="status">{result}</p>
        <button
          onClick={async () => {
            try {
              if (!navigator.storage?.persist) {
                setResult("Webbläsaren saknar stöd för beständig lagring.");
                return;
              }
              const granted = await navigator.storage.persist();
              const size = await navigator.storage.estimate();
              setResult(
                `${granted ? "Beständig lagring beviljades." : "Begäran nekades; appen fungerar men data kan rensas automatiskt."} Använt: ${Math.round((size.usage || 0) / 1024)} kB. Detta är inte en backup.`,
              );
            } catch {
              setResult(
                "Kunde inte begära beständig lagring. Appen kan fortfarande användas.",
              );
            }
          }}
        >
          Begär beständig lagring
        </button>
        <p>
          Rensad webbplatsdata, privat surfning eller en förlorad enhet kan
          innebära dataförlust. Spara säkerhetskopian utanför webbläsaren.
        </p>
      </section>
      <section>
        <h2>Utan nätverk</h2>
        <p>
          En redan laddad app kan redigeras och exporteras utan nätverk.
          Offline-start eller omladdning utan nätverk garanteras inte. Ingen
          inloggning, molnsynk eller extern odlingstjänst används.
        </p>
      </section>
    </main>
  );
}
