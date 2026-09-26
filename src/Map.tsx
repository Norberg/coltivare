import { useEffect, useMemo, useRef, useState } from "react";
import {
  active,
  transform,
  worldGeometry,
  type Point,
  type RecordData,
  type Geometry,
} from "./domain";
export type Tool =
  "select" | "pan" | "rectangle" | "ellipse" | "polygon" | "planting";
interface Props {
  garden: RecordData;
  records: RecordData[];
  date: string;
  selected?: string;
  tool: Tool;
  grid: boolean;
  snap: boolean;
  structure: boolean;
  plants: boolean;
  archived: boolean;
  placementDraft?: Geometry;
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
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [gesture, setGesture] = useState<{
    start: Point;
    record?: RecordData;
    original?: Geometry;
    pan?: typeof view;
    client?: Point;
    scale?: number;
    vertex?: number;
  }>();
  const point = (e: React.PointerEvent | React.MouseEvent): Point => {
    const s = svg.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      s.getScreenCTM()!.inverse(),
    );
    return {
      x: p.snap ? Math.round(pt.x * 10) / 10 : pt.x,
      y: p.snap ? Math.round(pt.y * 10) / 10 : pt.y,
    };
  };
  const byId = useMemo(
    () => new Map(p.records.map((r) => [r.id, r])),
    [p.records],
  );
  const visible = useMemo(
    () =>
      p.records.filter(
        (r) =>
          (p.archived || !r.archived) &&
          r.gardenId === p.garden.id &&
          active(r, p.date) &&
          ((r.kind === "object" && p.structure) ||
            (r.kind === "placement" &&
              p.plants &&
              (p.archived || !byId.get(r.plantingId!)?.archived))),
      ),
    [p.records, p.archived, p.garden.id, p.date, p.structure, p.plants, byId],
  );
  const cancel = () => {
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
        setGesture(undefined);
        setPolygon([]);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const shape = (g: Geometry) =>
    g.shape === "ellipse" ? (
      <ellipse
        cx={g.width / 2}
        cy={g.height / 2}
        rx={g.width / 2}
        ry={g.height / 2}
      />
    ) : g.shape === "polygon" ? (
      <polygon points={g.points?.map((v) => `${v.x},${v.y}`).join(" ")} />
    ) : (
      <rect width={g.width} height={g.height} rx={0.06} />
    );
  // Keep SVG nodes stable while panning; only the viewBox needs to change.
  const scene = useMemo(
    () =>
      visible.map((r) => {
        const g =
          gesture?.record?.id === r.id && draft
            ? draft
            : worldGeometry(r, p.records);
        return (
          <g
            key={r.id}
            transform={`translate(${g.x} ${g.y}) rotate(${g.rotation})`}
            className={`${r.kind === "placement" ? "plant-shape" : "structure-shape"} ${p.selected === r.id ? "selected" : ""} ${r.archived ? "archived" : ""}`}
            onPointerDown={(e) => {
              if (p.tool !== "select") return;
              e.stopPropagation();
              if (!p.onSelect(r.id)) return;
              if (!r.locked) {
                svg.current?.setPointerCapture(e.pointerId);
                setGesture({ start: point(e), record: r, original: g });
              }
            }}
          >
            <title>
              {r.name}
              {r.locked ? " (låst)" : ""}
            </title>
            {shape(g)}
            {r.kind === "placement" && byId.get(r.plantingId!)?.count === 1 && (
              <circle
                cx={g.width / 2}
                cy={g.height / 2}
                r={Math.min(g.width, g.height) * 0.08}
                fill="#244c3a"
              />
            )}
            <text
              x={g.width / 2}
              y={g.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(0.32, g.width / 6)}
            >
              {r.locked ? "🔒 " : ""}
              {r.name}
            </text>
            {p.selected === r.id &&
              !r.locked &&
              p.tool === "select" &&
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
        <span>1 ruta = 1 m · snäppning 10 cm</span>
      </div>
      <svg
        ref={svg}
        role="application"
        aria-label="Trädgårdskarta"
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
          if (p.tool === "select" || p.tool === "pan")
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
          const pt = point(e),
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
          if (gesture.vertex !== undefined && gesture.original) {
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
          } else if (gesture.record && gesture.original)
            setDraft({
              ...gesture.original,
              x: gesture.original.x + dx,
              y: gesture.original.y + dy,
            });
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
            const g = draft || {
              x: gesture.start.x,
              y: gesture.start.y,
              width: p.tool === "planting" ? 0.7 : 4,
              height: p.tool === "planting" ? 0.7 : 1.2,
              rotation: 0,
              shape:
                p.tool === "ellipse"
                  ? ("ellipse" as const)
                  : ("rectangle" as const),
            };
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
          <g className="draft" transform={`translate(${draft.x} ${draft.y})`}>
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
            : p.tool === "select"
              ? "Välj och dra objekt · dra tom yta för att panorera"
              : "Klicka eller dra för att skapa"}{" "}
          · Esc avbryter
        </span>
      </div>
    </div>
  );
}
