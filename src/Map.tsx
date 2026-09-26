import { useEffect, useMemo, useRef, useState } from "react";
import { PlantIcon } from "./PlantIcon";
import { mapLayer, pathGeometry } from "./mapLayout";
import { bounds } from "./geometry";
import { snapMove, type SnapGuide } from "./snapping";
import { resizeBounds, resizeGeometry, type ResizeCorner } from "./resize";
import {
  active,
  transform,
  worldGeometry,
  type Point,
  type RecordData,
  type Geometry,
} from "./domain";
export type Tool =
  | "select"
  | "move"
  | "resize"
  | "vertices"
  | "pan"
  | "rectangle"
  | "ellipse"
  | "polygon"
  | "path"
  | "planting";
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
  archived: boolean;
  placementDraft?: Geometry;
  pathWidth?: number;
  onSelect: (id: string) => boolean;
  onCreate: (g: Geometry) => void;
  onMove: (r: RecordData, g: Geometry) => void;
  onCancel: () => void;
}
export function GardenMap(p: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const fitWidth = Math.max(p.garden.width! + 2, (p.garden.height! + 2) / 0.7);
  const [view, setView] = useState({ x: -1, y: -1, w: fitWidth });
  const [draft, setDraft] = useState<Geometry>();
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [gesture, setGesture] = useState<{
    start: Point;
    record?: RecordData;
    original?: Geometry;
    pan?: typeof view;
    client?: Point;
    scale?: number;
    vertex?: number;
    resize?: ResizeCorner;
  }>();
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
            (p.archived || !r.archived) &&
            r.gardenId === p.garden.id &&
            active(r, p.date) &&
            ((r.kind === "object" && p.structure) ||
              (r.kind === "placement" &&
                p.plants &&
                (p.archived || !byId.get(r.plantingId!)?.archived))),
        )
        .sort((a, b) => mapLayer(a) - mapLayer(b)),
    [p.records, p.archived, p.garden.id, p.date, p.structure, p.plants, byId],
  );
  const snapTargets = useMemo(
    () =>
      p.edgeSnap
        ? visible
            .filter(
              (r) =>
                r.id !== gesture?.record?.id &&
                r.objectId !== gesture?.record?.id,
            )
            .map((r) => bounds(worldGeometry(r, p.records)))
        : [],
    [visible, p.edgeSnap, p.records, gesture?.record?.id],
  );
  const cancel = () => {
    setSnapGuides([]);
    setDraft(undefined);
    setGesture(undefined);
    setPolygon([]);
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
        setPolygon([]);
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
  // Keep SVG nodes stable while panning; only the viewBox needs to change.
  const scene = useMemo(
    () =>
      visible.map((r) => {
        const planting =
          r.kind === "placement" ? byId.get(r.plantingId!) : undefined;
        const icon = planting?.icon ?? planting?.snapshot?.icon;
        const color =
          r.color ??
          planting?.color ??
          planting?.snapshot?.color ??
          (r.category === "Gång" ? "#d1b899" : undefined);
        const g =
          gesture?.record?.id === r.id && draft
            ? draft
            : worldGeometry(r, p.records);
        return (
          <g
            key={r.id}
            data-layer={mapLayer(r)}
            transform={`translate(${g.x} ${g.y}) rotate(${g.rotation})`}
            className={`${r.kind === "placement" ? "plant-shape" : "structure-shape"} ${p.selected === r.id ? "selected" : ""} ${r.archived ? "archived" : ""}`}
            onPointerDown={(e) => {
              if (e.button !== 0 || (p.tool !== "select" && p.tool !== "move"))
                return;
              e.stopPropagation();
              if (!p.onSelect(r.id)) return;
              if (!r.locked && p.tool === "move") {
                svg.current?.setPointerCapture(e.pointerId);
                setGesture({ start: point(e, false), record: r, original: g });
              }
            }}
          >
            <title>
              {r.name}
              {r.locked ? " (låst)" : ""}
            </title>
            {shape(g, color)}
            {r.kind === "placement" &&
              (!icon || icon === "none") &&
              byId.get(r.plantingId!)?.count === 1 && (
                <circle
                  cx={g.width / 2}
                  cy={g.height / 2}
                  r={Math.min(g.width, g.height) * 0.08}
                  fill="#244c3a"
                />
              )}
            {icon && icon !== "none" && (
              <PlantIcon
                icon={icon}
                className="map-plant-icon"
                pointerEvents="none"
                x={g.width / 2 - Math.min(g.width, g.height) * 0.35}
                y={g.height / 2 - Math.min(g.width, g.height) * 0.38}
                width={Math.min(g.width, g.height) * 0.7}
                height={Math.min(g.width, g.height) * 0.7}
              />
            )}
            {r.kind !== "placement" && (
              <text
                x={g.width / 2}
                y={icon && icon !== "none" ? g.height * 0.9 : g.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(0.32, g.width / 6)}
              >
                {r.locked ? "🔒 " : ""}
                {r.name}
              </text>
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
            {p.selected === r.id &&
              !r.locked &&
              p.tool === "vertices" &&
              g.shape === "polygon" &&
              g.points!.map((point, index) => (
                <circle
                  key={index}
                  aria-label={`Flytta hörn ${index + 1}`}
                  role="button"
                  cx={point.x}
                  cy={point.y}
                  r={view.w * 0.006}
                  fill="#fff"
                  stroke="#bc791a"
                  strokeWidth={view.w * 0.0015}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svg.current?.setPointerCapture(e.pointerId);
                    setGesture({
                      start: point,
                      record: r,
                      original: g,
                      vertex: index,
                    });
                  }}
                />
              ))}
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
      view.w,
      p.snap,
      byId,
    ],
  );
  return (
    <div className="map-shell">
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
          if (p.tool === "select" || p.tool === "move") return;
          svg.current?.setPointerCapture(e.pointerId);
          const pt = point(e);
          if (p.tool === "polygon") {
            setPolygon((previous) =>
              previous.length &&
              Math.hypot(
                previous[previous.length - 1].x - pt.x,
                previous[previous.length - 1].y - pt.y,
              ) < 0.001
                ? previous
                : [...previous, pt],
            );
            return;
          }
          if (p.tool === "pan" || p.tool === "resize" || p.tool === "vertices")
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
          } else if (gesture.vertex !== undefined && gesture.original) {
            const local = transform(pt, gesture.original, true);
            const points = gesture.original.points!.map((p, i) =>
              i === gesture.vertex ? local : p,
            );
            setDraft({
              ...gesture.original,
              points,
              width:
                Math.max(...points.map((p) => p.x)) -
                Math.min(...points.map((p) => p.x)),
              height:
                Math.max(...points.map((p) => p.y)) -
                Math.min(...points.map((p) => p.y)),
            });
          } else if (gesture.record && gesture.original) {
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
        onPointerUp={() => {
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
                p.onMove(gesture.record, local);
              }
            } else p.onCreate(g);
          }
          setGesture(undefined);
          setDraft(undefined);
          setSnapGuides([]);
        }}
        onPointerCancel={cancel}
        onDoubleClick={() => {
          if (p.tool === "polygon" && polygon.length >= 3) {
            const x = Math.min(...polygon.map((v) => v.x)),
              y = Math.min(...polygon.map((v) => v.y));
            p.onCreate({
              x,
              y,
              width: Math.max(...polygon.map((v) => v.x)) - x,
              height: Math.max(...polygon.map((v) => v.y)) - y,
              rotation: 0,
              shape: "polygon",
              points: polygon.map((v) => ({ x: v.x - x, y: v.y - y })),
            });
            setPolygon([]);
          }
        }}
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
        <g className="plant-labels" pointerEvents="none">
          {visible
            .filter((r) => r.kind === "placement")
            .map((r) => {
              const planting = byId.get(r.plantingId!);
              const icon = planting?.icon ?? planting?.snapshot?.icon;
              const g =
                gesture?.record?.id === r.id && draft
                  ? draft
                  : worldGeometry(r, p.records);
              const position = transform(
                {
                  x: g.width / 2,
                  y: icon && icon !== "none" ? g.height : g.height / 2,
                },
                g,
              );
              return (
                <text
                  key={r.id}
                  className="plant-name"
                  x={position.x}
                  y={position.y}
                  dy={icon && icon !== "none" ? "1em" : ".35em"}
                  textAnchor="middle"
                  fontSize={view.w * 0.025}
                >
                  {planting?.name || r.name}
                </text>
              );
            })}
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
        {polygon.length > 0 && (
          <polyline
            points={polygon.map((v) => `${v.x},${v.y}`).join(" ")}
            fill="#a4ba8c55"
            stroke="#244c3a"
            strokeWidth=".06"
          />
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
          {p.tool === "polygon"
            ? "Klicka för hörn · dubbelklicka för att sluta polygonen"
            : p.tool === "path"
              ? "Dra gångens mittlinje genom landet · släpp för att spara"
              : p.tool === "resize"
                ? "Dra ett hörn för att ändra storlek · släpp för att spara"
                : p.tool === "vertices"
                  ? "Dra ett polygonhörn · släpp för att spara"
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
