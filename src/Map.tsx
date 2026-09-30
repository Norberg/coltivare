import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlantIcon } from "./PlantIcon";
import { mixtureLayout } from "./mixtureLayout";
import {
  layoutLabels,
  shouldPreserveLabels,
  type LabelCandidate,
} from "./labelLayout";
import { mapLayer, pathGeometry } from "./mapLayout";
import { bounds } from "./geometry";
import { snapMove, type SnapGuide } from "./snapping";
import { groupBounds, translateGroup } from "./groupMove";
import { resizeBounds, resizeGeometry, type ResizeCorner } from "./resize";
import {
  active,
  plantingPlants,
  transform,
  worldGeometry,
  type Point,
  type RecordData,
  type Geometry,
  type Change,
} from "./domain";
export type Tool =
  | "select"
  | "move"
  | "resize"
  | "pan"
  | "rectangle"
  | "ellipse"
  | "path"
  | "planting"
  | "plantGrid";
interface Props {
  garden: RecordData;
  records: RecordData[];
  date: string;
  selected?: string;
  tool: Tool;
  grid: boolean;
  snap: boolean;
  edgeSnap: boolean;
  structure: boolean;
  plants: boolean;
  placementDraft?: Geometry;
  pathWidth?: number;
  onSelect: (id: string) => boolean;
  onCreate: (g: Geometry) => void | Promise<void>;
  onMove: (r: RecordData, g: Geometry) => Promise<void>;
  onMoveMany: (changes: Change[]) => Promise<boolean>;
  onCancel: () => void;
}
export function GardenMap(p: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const fitWidth = Math.max(p.garden.width! + 2, (p.garden.height! + 2) / 0.7);
  const [view, setView] = useState({ x: -1, y: -1, w: fitWidth });
  const [draft, setDraft] = useState<Geometry>();
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [multi, setMulti] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [failedGroup, setFailedGroup] = useState<Change[]>();
  const [gesture, setGesture] = useState<{
    start: Point;
    record?: RecordData;
    original?: Geometry;
    pan?: typeof view;
    client?: Point;
    scale?: number;
    resize?: ResizeCorner;
    group?: RecordData[];
    marquee?: boolean;
  }>();
  useEffect(() => {
    setMulti(false);
    setMarked([]);
    setFailedGroup(undefined);
  }, [p.tool, p.date]);
  const point = (
    e: React.PointerEvent | React.MouseEvent,
    grid = p.snap,
  ): Point => {
    const s = svg.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      s.getScreenCTM()!.inverse(),
    );
    return {
      x: grid ? Math.round(pt.x * 10) / 10 : pt.x,
      y: grid ? Math.round(pt.y * 10) / 10 : pt.y,
    };
  };
  const byId = useMemo(
    () => new Map(p.records.map((r) => [r.id, r])),
    [p.records],
  );
  const visible = useMemo(
    () =>
      p.records
        .filter(
          (r) =>
            r.gardenId === p.garden.id &&
            active(r, p.date) &&
            ((r.kind === "object" && p.structure) ||
              (r.kind === "plantGrid" && p.plants) ||
              (r.kind === "placement" && p.plants)),
        )
        .sort((a, b) => mapLayer(a) - mapLayer(b)),
    [p.records, p.garden.id, p.date, p.structure, p.plants],
  );
  const snapTargets = useMemo(
    () =>
      p.edgeSnap
        ? visible
            .filter(
              (r) =>
                r.id !== gesture?.record?.id &&
                r.objectId !== gesture?.record?.id &&
                !gesture?.group?.some(
                  (member) => member.id === r.id || member.id === r.objectId,
                ),
            )
            .map((r) => bounds(worldGeometry(r, p.records)))
        : [],
    [visible, p.edgeSnap, p.records, gesture?.record?.id, gesture?.group],
  );
  const groupDelta =
    gesture?.group && draft && gesture.original
      ? { x: draft.x - gesture.original.x, y: draft.y - gesture.original.y }
      : undefined;
  const preview = (r: RecordData) => {
    const g = worldGeometry(r, p.records);
    if (
      groupDelta &&
      gesture?.group?.some(
        (member) => member.id === r.id || member.id === r.objectId,
      )
    )
      return { ...g, x: g.x + groupDelta.x, y: g.y + groupDelta.y };
    return gesture?.record?.id === r.id && draft && !gesture.group ? draft : g;
  };
  async function saveGroup(changes: Change[]) {
    setSavingGroup(true);
    try {
      setFailedGroup((await p.onMoveMany(changes)) ? undefined : changes);
    } finally {
      setSavingGroup(false);
    }
  }
  const cancel = () => {
    setSnapGuides([]);
    setDraft(undefined);
    setGesture(undefined);
    p.onCancel();
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !(event.target as HTMLElement).closest("input,textarea,select")
      ) {
        setDraft(undefined);
        setSnapGuides([]);
        setGesture(undefined);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const shape = (g: Geometry, color?: string) =>
    g.shape === "ellipse" ? (
      <ellipse
        fill={color}
        cx={g.width / 2}
        cy={g.height / 2}
        rx={g.width / 2}
        ry={g.height / 2}
      />
    ) : g.shape === "polygon" ? (
      <polygon
        fill={color}
        points={g.points?.map((v) => `${v.x},${v.y}`).join(" ")}
      />
    ) : (
      <rect fill={color} width={g.width} height={g.height} rx={0.06} />
    );
  const labelCandidates = useMemo<LabelCandidate[]>(() => {
    const fontSize = view.w * 0.025;
    return visible.flatMap((record) => {
      const geometry = preview(record);
      // Plants normally sit above beds and paths; selection takes priority.
      const priority = mapLayer(record) + (record.id === p.selected ? 10 : 0);
      const hasRoom = (text: string, size: number) =>
        text.length * size * 0.48 <=
        Math.max(geometry.width, geometry.height) * 0.85;
      if (record.kind === "plantGrid") {
        if (record.showName === false) return [];
        const cellWidth = geometry.width / record.columns!;
        const cellHeight = geometry.height / record.rows!;
        return (record.cellPlantIds || []).flatMap((plantId, index) => {
          const plant = plantId ? byId.get(plantId) : undefined;
          if (!plant) return [];
          const hasIcon = !!plant.icon && plant.icon !== "none";
          const size = Math.min(fontSize, cellHeight * (hasIcon ? 0.15 : 0.26));
          if (plant.name.length * size * 0.56 > cellWidth * 0.85) return [];
          const iconSize = Math.min(cellWidth, cellHeight);
          const position = transform(
            {
              x: ((index % record.columns!) + 0.5) * cellWidth,
              y:
                Math.floor(index / record.columns!) * cellHeight +
                cellHeight / 2 +
                (hasIcon ? iconSize * 0.36 + size * 0.7 : 0),
            },
            geometry,
          );
          return [
            {
              id: `${record.id}:${index}`,
              x: position.x,
              y: position.y,
              lines: [plant.name],
              fontSize: size,
              priority,
              className: "plant-name",
            },
          ];
        });
      }
      if (record.kind === "object") {
        const size = Math.min(0.32, geometry.width / 6);
        if (record.showName === false || !hasRoom(record.name, size)) return [];
        const position = transform(
          { x: geometry.width / 2, y: geometry.height / 2 },
          geometry,
        );
        return [
          {
            id: record.id,
            x: position.x,
            y: position.y,
            lines: [`${record.locked ? "🔒 " : ""}${record.name}`],
            fontSize: size,
            priority,
            className: "structure-label",
          },
        ];
      }
      const planting = byId.get(record.plantingId!);
      const name = planting?.name || record.name;
      if (
        record.showName === false ||
        planting?.showName === false ||
        !hasRoom(name, fontSize)
      )
        return [];
      const icon = planting?.icon ?? planting?.snapshot?.icon;
      const hasIcons = planting?.additionalPlants?.length
        ? plantingPlants(planting).some(
            (plant) => plant.icon && plant.icon !== "none",
          )
        : !!icon && icon !== "none";
      const iconSize = Math.min(geometry.width, geometry.height);
      const labelCenterY = hasIcons
        ? geometry.height / 2 + iconSize * 0.36
        : geometry.height / 2;
      const position = transform(
        {
          x: geometry.width / 2,
          // Labels are centred horizontally and sit just below a plant icon.
          y: hasIcons ? labelCenterY + fontSize * 0.7 : labelCenterY,
        },
        geometry,
      );
      return [
        {
          id: record.id,
          x: position.x,
          y: position.y,
          // The planting name is the map label; a mixed planting's full
          // species list remains available in the hover title and panel.
          lines: [name],
          fontSize,
          priority,
          className: "plant-name",
        },
      ];
    });
  }, [visible, p.selected, view.w, byId, p.records, draft, gesture]);
  // A reference token avoids serialising every record on each zoom. Data or
  // geometry changes create a new token; zooming and panning do not.
  const labelLayoutVersion = useMemo(() => ({}), [visible, p.selected, draft]);
  const [labelHistory, setLabelHistory] = useState<{
    width: number;
    version?: object;
    ids: string[];
  }>({ width: fitWidth, ids: [] });
  const preserveLabels = shouldPreserveLabels(
    labelHistory.width,
    view.w,
    labelHistory.version === labelLayoutVersion,
  );
  const preservedLabelIds = useMemo(
    () => new Set(labelHistory.ids),
    [labelHistory.ids],
  );
  const labels = useMemo(
    () =>
      layoutLabels(
        labelCandidates,
        preserveLabels ? preservedLabelIds : undefined,
      ),
    [labelCandidates, preserveLabels, preservedLabelIds],
  );
  const labelIds = labels.map((label) => label.id).join("|");
  useLayoutEffect(() => {
    setLabelHistory((previous) =>
      previous.width === view.w &&
      previous.version === labelLayoutVersion &&
      previous.ids.join("|") === labelIds
        ? previous
        : {
            width: view.w,
            version: labelLayoutVersion,
            ids: labels.map((label) => label.id),
          },
    );
  }, [view.w, labelLayoutVersion, labelIds, labels]);
  // Keep SVG nodes stable while panning; only the viewBox needs to change.
  const scene = useMemo(
    () =>
      visible.map((r) => {
        const planting =
          r.kind === "placement" ? byId.get(r.plantingId!) : undefined;
        const iconSource =
          planting?.icon !== undefined ? planting : planting?.snapshot;
        const icon = iconSource?.icon;
        const iconVariant = iconSource?.iconVariant;
        const color =
          r.color ??
          planting?.color ??
          planting?.snapshot?.color ??
          (r.category === "Gång" ? "#d1b899" : undefined);
        const g = preview(r);
        const mixed = !!planting?.additionalPlants?.length;
        const mixedIcons = mixed
          ? mixtureLayout(g, plantingPlants(planting))
          : [];
        return (
          <g
            key={r.id}
            data-layer={mapLayer(r)}
            transform={`translate(${g.x} ${g.y}) rotate(${g.rotation})`}
            className={`${r.kind === "placement" || r.kind === "plantGrid" ? "plant-shape" : "structure-shape"} ${(p.tool === "move" && multi ? marked.includes(r.id) : p.selected === r.id) ? "selected" : ""}`}
            onPointerDown={(e) => {
              if (e.button !== 0 || (p.tool !== "select" && p.tool !== "move"))
                return;
              e.stopPropagation();
              if (savingGroup) return;
              if (!p.onSelect(r.id)) return;
              if (p.tool === "move" && multi) {
                if (r.locked) return;
                setFailedGroup(undefined);
                if (!marked.includes(r.id)) {
                  setMarked((ids) => [...ids, r.id]);
                  return;
                }
                const group = visible.filter(
                  (item) => marked.includes(item.id) && !item.locked,
                );
                svg.current?.setPointerCapture(e.pointerId);
                setGesture({
                  start: point(e, false),
                  record: r,
                  original: groupBounds(group, p.records),
                  group,
                });
                return;
              }
              if (!r.locked && p.tool === "move") {
                svg.current?.setPointerCapture(e.pointerId);
                setGesture({ start: point(e, false), record: r, original: g });
              }
            }}
          >
            {r.kind !== "plantGrid" &&
              r.showName !== false &&
              planting?.showName !== false && (
                <title>
                  {r.name}
                  {!!planting?.additionalPlants?.length &&
                    `: ${plantingPlants(planting)
                      .map((plant) => plant.name)
                      .join(", ")}`}
                  {r.locked ? " (låst)" : ""}
                </title>
              )}
            {r.kind === "plantGrid" ? (
              <>
                <rect
                  className="plant-grid-background"
                  width={g.width}
                  height={g.height}
                  rx={0.06}
                />
                {r.cellPlantIds?.map((plantId, index) => {
                  const cellWidth = g.width / r.columns!;
                  const cellHeight = g.height / r.rows!;
                  const x = (index % r.columns!) * cellWidth;
                  const y = Math.floor(index / r.columns!) * cellHeight;
                  const plant = plantId ? byId.get(plantId) : undefined;
                  const iconSize = Math.min(cellWidth, cellHeight);
                  const size = iconSize * 0.7;
                  return (
                    <g key={index} data-cell={index + 1}>
                      <rect
                        className="plant-grid-cell"
                        x={x}
                        y={y}
                        width={cellWidth}
                        height={cellHeight}
                        rx={0.06}
                      >
                        {plant && <title>{plant.name}</title>}
                      </rect>
                      {plant?.icon && plant.icon !== "none" ? (
                        <PlantIcon
                          icon={plant.icon}
                          variant={plant.iconVariant}
                          className="map-plant-icon"
                          x={x + (cellWidth - size) / 2}
                          y={y + cellHeight / 2 - iconSize * 0.38}
                          width={size}
                          height={size}
                          pointerEvents="none"
                        />
                      ) : null}
                    </g>
                  );
                })}
              </>
            ) : (
              shape(g, color)
            )}
            {r.kind === "placement" &&
              (!icon || icon === "none") &&
              !planting?.additionalPlants?.length &&
              byId.get(r.plantingId!)?.count === 1 && (
                <circle
                  cx={g.width / 2}
                  cy={g.height / 2}
                  r={Math.min(g.width, g.height) * 0.08}
                  fill="#244c3a"
                />
              )}
            {mixedIcons.length > 0 && (
              <g className="mixture-icons" pointerEvents="none">
                {mixedIcons.map((item, index) => (
                  <PlantIcon
                    key={index}
                    className="map-plant-icon"
                    data-plant-id={item.plantId}
                    icon={item.icon}
                    variant={item.variant}
                    x={item.x}
                    y={item.y}
                    width={item.size}
                    height={item.size}
                  />
                ))}
              </g>
            )}
            {!mixed && icon && icon !== "none" && (
              <PlantIcon
                icon={icon}
                variant={iconVariant}
                className="map-plant-icon"
                pointerEvents="none"
                x={g.width / 2 - Math.min(g.width, g.height) * 0.35}
                y={g.height / 2 - Math.min(g.width, g.height) * 0.38}
                width={Math.min(g.width, g.height) * 0.7}
                height={Math.min(g.width, g.height) * 0.7}
              />
            )}
            {p.selected === r.id &&
              !r.locked &&
              p.tool === "resize" &&
              (["nw", "ne", "sw", "se"] as const).map((corner) => {
                const min = resizeBounds(g);
                return (
                  <rect
                    key={corner}
                    role="button"
                    aria-label={`Ändra storlek ${corner}`}
                    className="resize-handle"
                    x={
                      min.x +
                      (corner.includes("w") ? 0 : g.width) -
                      view.w * 0.006
                    }
                    y={
                      min.y +
                      (corner.includes("n") ? 0 : g.height) -
                      view.w * 0.006
                    }
                    width={view.w * 0.012}
                    height={view.w * 0.012}
                    fill="#fff"
                    stroke="#bc791a"
                    strokeWidth={view.w * 0.0015}
                    style={{
                      cursor:
                        corner === "nw" || corner === "se"
                          ? "nwse-resize"
                          : "nesw-resize",
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      svg.current?.setPointerCapture(e.pointerId);
                      setGesture({
                        start: transform(point(e), g, true),
                        record: r,
                        original: g,
                        resize: corner,
                      });
                    }}
                  />
                );
              })}
          </g>
        );
      }),
    [
      visible,
      p.selected,
      p.tool,
      p.onSelect,
      p.records,
      draft,
      gesture?.record?.id,
      gesture?.group,
      multi,
      marked,
      savingGroup,
      view.w,
      p.snap,
      byId,
    ],
  );
  return (
    <div className="map-shell">
      {p.tool === "move" && (
        <div className="multi-move-tools">
          <label>
            <input
              type="checkbox"
              checked={multi}
              disabled={savingGroup}
              onChange={(e) => {
                setMulti(e.target.checked);
                setMarked([]);
                setFailedGroup(undefined);
              }}
            />{" "}
            Markera många
          </label>
          {multi && (
            <>
              <span>
                {
                  visible.filter((r) => marked.includes(r.id) && !r.locked)
                    .length
                }{" "}
                markerade
              </span>
              <button disabled={savingGroup} onClick={() => setMarked([])}>
                Avmarkera alla
              </button>
              <small>
                Klicka på objekt eller dra en markeringsruta på tom yta. Dra ett
                markerat objekt för att flytta gruppen. Låsta objekt undantas.
              </small>
            </>
          )}
          {failedGroup && (
            <span role="alert">
              Gruppflytten sparades inte.{" "}
              <button
                disabled={savingGroup}
                onClick={() => void saveGroup(failedGroup)}
              >
                Försök spara gruppflytten igen
              </button>
              <button onClick={() => setFailedGroup(undefined)}>
                Avbryt gruppflytten
              </button>
            </span>
          )}
        </div>
      )}
      <div className="map-controls">
        <button
          onClick={() => setView((v) => ({ ...v, w: v.w * 0.8 }))}
          aria-label="Zooma in"
        >
          +
        </button>
        <button
          onClick={() => setView((v) => ({ ...v, w: v.w / 0.8 }))}
          aria-label="Zooma ut"
        >
          −
        </button>
        <button onClick={() => setView({ x: -1, y: -1, w: fitWidth })}>
          Hela trädgården
        </button>
        <span>
          1 ruta = 1 m{p.snap ? " · snäppning 10 cm" : ""}
          {p.edgeSnap ? " · kantsnäppning" : ""}
        </span>
      </div>
      <svg
        ref={svg}
        role="application"
        aria-label="Trädgårdskarta"
        data-tool={p.tool}
        tabIndex={0}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w * 0.7}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        onWheel={(e) =>
          setView((v) => ({
            ...v,
            w: Math.max(2, Math.min(500, v.w * (e.deltaY > 0 ? 1.1 : 0.9))),
          }))
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (savingGroup) return;
          if (p.tool === "move" && multi) {
            svg.current?.setPointerCapture(e.pointerId);
            setGesture({ start: point(e, false), marquee: true });
            return;
          }
          if (p.tool === "select" || p.tool === "move") return;
          svg.current?.setPointerCapture(e.pointerId);
          const pt = point(e);
          if (p.tool === "pan" || p.tool === "resize")
            setGesture({
              start: pt,
              pan: view,
              client: { x: e.clientX, y: e.clientY },
              scale: 1 / svg.current!.getScreenCTM()!.a,
            });
          else setGesture({ start: pt });
        }}
        onPointerMove={(e) => {
          if (!gesture) return;
          const pt = point(e, p.tool === "move" ? false : p.snap),
            dx = pt.x - gesture.start.x,
            dy = pt.y - gesture.start.y;
          if (gesture.pan) {
            setView({
              ...gesture.pan,
              x:
                gesture.pan.x -
                (e.clientX - gesture.client!.x) * gesture.scale!,
              y:
                gesture.pan.y -
                (e.clientY - gesture.client!.y) * gesture.scale!,
            });
            return;
          }
          if (gesture.resize && gesture.original) {
            const local = transform(pt, gesture.original, true);
            setDraft(
              resizeGeometry(
                gesture.original,
                gesture.resize,
                { x: local.x - gesture.start.x, y: local.y - gesture.start.y },
                p.snap,
              ),
            );
          } else if (gesture.record && gesture.original) {
            if (
              gesture.group &&
              Math.hypot(dx, dy) * Math.abs(svg.current!.getScreenCTM()!.a) < 3
            )
              return;
            const raw = {
              ...gesture.original,
              x: gesture.original.x + dx,
              y: gesture.original.y + dy,
            };
            const scale = svg.current!.getScreenCTM()!.a;
            const result = snapMove(
              raw,
              snapTargets,
              8 / Math.abs(scale),
              p.snap,
            );
            setDraft(result.geometry);
            setSnapGuides(result.guides);
          } else if (p.tool === "path")
            setDraft(pathGeometry(gesture.start, pt, p.pathWidth || 0.8));
          else
            setDraft({
              x: Math.min(pt.x, gesture.start.x),
              y: Math.min(pt.y, gesture.start.y),
              width: Math.max(0.1, Math.abs(dx)),
              height: Math.max(0.1, Math.abs(dy)),
              rotation: 0,
              shape: p.tool === "ellipse" ? "ellipse" : "rectangle",
            });
        }}
        onPointerUp={async () => {
          if (gesture?.marquee) {
            const box = draft ? bounds(draft) : undefined;
            setMarked(
              box
                ? visible
                    .filter((r) => {
                      if (r.locked) return false;
                      const b = bounds(worldGeometry(r, p.records));
                      return (
                        b.minX >= box.minX &&
                        b.maxX <= box.maxX &&
                        b.minY >= box.minY &&
                        b.maxY <= box.maxY
                      );
                    })
                    .map((r) => r.id)
                : [],
            );
            setFailedGroup(undefined);
            setGesture(undefined);
            setDraft(undefined);
            return;
          }
          if (gesture?.group) {
            if (groupDelta)
              await saveGroup(
                translateGroup(gesture.group, p.records, groupDelta),
              );
            else
              setMarked((ids) => ids.filter((id) => id !== gesture.record!.id));
            setGesture(undefined);
            setDraft(undefined);
            setSnapGuides([]);
            return;
          }
          if (gesture && !gesture.pan) {
            const g =
              draft ||
              (p.tool === "path"
                ? pathGeometry(
                    gesture.start,
                    { x: gesture.start.x + 4, y: gesture.start.y },
                    p.pathWidth || 0.8,
                  )
                : {
                    x: gesture.start.x,
                    y: gesture.start.y,
                    width: p.tool === "planting" ? 0.7 : 4,
                    height: p.tool === "planting" ? 0.7 : 1.2,
                    rotation: 0,
                    shape:
                      p.tool === "ellipse"
                        ? ("ellipse" as const)
                        : ("rectangle" as const),
                  });
            if (gesture.record) {
              if (draft) {
                const parent = p.records.find(
                  (r) => r.id === gesture.record!.objectId,
                )?.geometry;
                const local = parent
                  ? {
                      ...g,
                      ...transform(g, parent, true),
                      rotation: g.rotation - parent.rotation,
                    }
                  : g;
                await p.onMove(gesture.record, local);
              }
            } else await p.onCreate(g);
          }
          setGesture(undefined);
          setDraft(undefined);
          setSnapGuides([]);
        }}
        onPointerCancel={cancel}
      >
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#cdd8c9"
              strokeWidth=".015"
            />
          </pattern>
        </defs>
        <rect
          x={0}
          y={0}
          width={p.garden.width}
          height={p.garden.height}
          fill="#f5f5e9"
          stroke="#899c7e"
          strokeWidth=".045"
        />
        {p.grid && (
          <rect
            x={0}
            y={0}
            width={p.garden.width}
            height={p.garden.height}
            fill="url(#grid)"
          />
        )}
        {scene}
        <g
          className="snap-guides"
          pointerEvents="none"
          aria-label="Kantsnäppning"
        >
          {snapGuides.map((g) => (
            <line
              key={g.axis}
              data-axis={g.axis}
              x1={g.axis === "x" ? g.value : g.from}
              y1={g.axis === "y" ? g.value : g.from}
              x2={g.axis === "x" ? g.value : g.to}
              y2={g.axis === "y" ? g.value : g.to}
              stroke="#b35c20"
              strokeWidth="2"
              strokeDasharray="5 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g className="map-labels" pointerEvents="none">
          {labels.map((label) => (
            <text
              key={label.id}
              className={label.className}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              fontSize={label.fontSize}
            >
              {label.lines.map((line, index) => (
                <tspan
                  key={line}
                  x={label.x}
                  dy={index ? "1.2em" : ".35em"}
                  fontSize={index ? "65%" : undefined}
                  stroke={index ? "none" : undefined}
                >
                  {line}
                </tspan>
              ))}
            </text>
          ))}
        </g>
        {p.placementDraft && !draft && (
          <g
            className="draft"
            aria-label="Osparad plantering"
            pointerEvents="none"
            transform={`translate(${p.placementDraft.x} ${p.placementDraft.y})`}
          >
            {shape(p.placementDraft)}
          </g>
        )}
        {draft && !gesture?.record && (
          <g
            className="draft"
            transform={`translate(${draft.x} ${draft.y}) rotate(${draft.rotation})`}
          >
            {shape(draft)}
          </g>
        )}
        <g
          transform={`translate(${view.x + 0.5} ${view.y + view.w * 0.7 - 0.6})`}
          pointerEvents="none"
        >
          <path
            d="M 0 -.1 V 0 H 1 V -.1"
            stroke="#344b3b"
            strokeWidth=".025"
            fill="none"
          />
          <text x=".5" y=".25" textAnchor="middle" fontSize=".2" fill="#344b3b">
            1 m
          </text>
        </g>
      </svg>
      <div className="map-caption">
        <span>↑ N</span>
        <span>
          {p.tool === "path"
            ? "Dra gångens mittlinje genom landet · släpp för att spara"
            : p.tool === "resize"
              ? "Dra ett hörn för att ändra storlek · släpp för att spara"
              : p.tool === "pan"
                ? "Dra för att panorera"
                : p.tool === "select"
                  ? "Klicka på ett objekt för att välja det"
                  : p.tool === "move"
                    ? "Dra ett objekt · hjälplinjer visar kantsnäppning"
                    : "Klicka eller dra för att skapa"}{" "}
          · Esc avbryter
        </span>
      </div>
    </div>
  );
}
