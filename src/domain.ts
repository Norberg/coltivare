export type Kind =
  | "workspace"
  | "garden"
  | "object"
  | "plant"
  | "planting"
  | "placement"
  | "event";
export type Shape = "rectangle" | "ellipse" | "polygon";
export interface Point {
  x: number;
  y: number;
}
export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: Shape;
  points?: Point[];
}
export interface RecordData {
  id: string;
  kind: Kind;
  workspaceId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  name: string;
  notes: string;
  gardenId?: string;
  geometry?: Geometry;
  width?: number;
  height?: number;
  timezone?: string;
  category?: string;
  locked?: boolean;
  startDate?: string;
  endDate?: string;
  unknownStart?: boolean;
  layer?: "actual";
  plantId?: string;
  plantingId?: string;
  objectId?: string;
  count?: number;
  snapshot?: RecordData;
  fields?: Record<string, string>;
  targetId?: string;
  date?: string;
  eventType?: string;
  quantity?: number;
  unit?: string;
  lastGardenId?: string;
}
export interface Change {
  before?: RecordData;
  after: RecordData;
}
export interface History {
  id: string;
  undo: Change[][];
  redo: Change[][];
}
export interface Snapshot {
  schemaVersion: 1;
  exportKind: "garden" | "workspace";
  exportedAt: string;
  records: RecordData[];
  histories?: History[];
}
export class DomainError extends Error {
  constructor(
    public code:
      "validation" | "conflict" | "quota" | "unavailable" | "version",
    message: string,
  ) {
    super(message);
  }
}
export const categories = [
  "Tomtgräns",
  "Odlingsland",
  "Pallkrage",
  "Växthus",
  "Gång",
  "Byggnad",
  "Generisk yta",
];
export const eventTypes = [
  "Sådd",
  "Groning",
  "Omskolning",
  "Utplantering",
  "Vattning",
  "Gödsling",
  "Beskärning",
  "Skörd",
  "Borttagning",
  "Anteckning",
];
export function makeRecord(
  kind: Kind,
  workspaceId: string,
  values: Partial<RecordData> = {},
): RecordData {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    workspaceId,
    revision: 0,
    archived: false,
    name: "",
    notes: "",
    ...values,
    createdAt: now,
    updatedAt: now,
  };
}
export function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function addDays(s: string, days: number) {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function shiftDate(s: string, months: number) {
  const d = new Date(s + "T12:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d.toISOString().slice(0, 10);
}
export function active(r: RecordData, date: string) {
  return (
    (!r.startDate || r.startDate <= date) && (!r.endDate || date < r.endDate)
  );
}
export function periodsOverlap(a: RecordData, b: RecordData) {
  return (
    (!a.endDate || !b.startDate || b.startDate < a.endDate) &&
    (!b.endDate || !a.startDate || a.startDate < b.endDate)
  );
}
export function numberValue(s: string) {
  return Number(s.replace(",", "."));
}
export function transform(p: Point, g: Geometry, inverse = false): Point {
  const a = ((g.rotation * Math.PI) / 180) * (inverse ? -1 : 1);
  const x = inverse ? p.x - g.x : p.x,
    y = inverse ? p.y - g.y : p.y;
  return {
    x: x * Math.cos(a) - y * Math.sin(a) + (inverse ? 0 : g.x),
    y: x * Math.sin(a) + y * Math.cos(a) + (inverse ? 0 : g.y),
  };
}
export function worldGeometry(r: RecordData, records: RecordData[]): Geometry {
  const g = r.geometry!;
  if (!r.objectId) return g;
  const parent = records.find((p) => p.id === r.objectId)?.geometry;
  return parent
    ? { ...g, ...transform(g, parent), rotation: g.rotation + parent.rotation }
    : g;
}
function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return (
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
  );
}
export function vertices(g: Geometry): Point[] {
  const points =
    g.shape === "polygon"
      ? g.points!
      : g.shape === "ellipse"
        ? Array.from({ length: 64 }, (_, i) => ({
            x: g.width / 2 + (Math.cos((i * Math.PI) / 32) * g.width) / 2,
            y: g.height / 2 + (Math.sin((i * Math.PI) / 32) * g.height) / 2,
          }))
        : [
            { x: 0, y: 0 },
            { x: g.width, y: 0 },
            { x: g.width, y: g.height },
            { x: 0, y: g.height },
          ];
  return points.map((p) => transform(p, g));
}
export function inside(p: Point, polygon: Point[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
function onSegment(p: Point, a: Point, b: Point) {
  return (
    Math.abs(cross(a, b, p)) < 1e-9 &&
    p.x >= Math.min(a.x, b.x) - 1e-9 &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    p.y >= Math.min(a.y, b.y) - 1e-9 &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  );
}
export function containsPoint(p: Point, polygon: Point[]) {
  return (
    inside(p, polygon) ||
    polygon.some((a, i) => onSegment(p, a, polygon[(i + 1) % polygon.length]))
  );
}
export { overlaps } from "./geometry";
export function validateGeometry(g: Geometry) {
  if (
    !g ||
    !["rectangle", "ellipse", "polygon"].includes(g.shape) ||
    ![g.x, g.y, g.width, g.height, g.rotation].every(Number.isFinite) ||
    g.width <= 0 ||
    g.height <= 0
  )
    throw new DomainError(
      "validation",
      "Formen måste ha giltiga mått och positiv area.",
    );
  if (g.shape === "polygon") {
    const p = g.points;
    if (
      !p ||
      p.length < 3 ||
      p.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y))
    )
      throw new DomainError(
        "validation",
        "Polygonen behöver minst tre giltiga hörn.",
      );
    const area = p.reduce(
      (sum, a, i) =>
        sum + a.x * p[(i + 1) % p.length].y - a.y * p[(i + 1) % p.length].x,
      0,
    );
    if (Math.abs(area) < 1e-8)
      throw new DomainError("validation", "Polygonen måste ha positiv area.");
    if (
      p.some((a, i) =>
        p.some((b, j) => j !== i && Math.hypot(a.x - b.x, a.y - b.y) < 1e-9),
      )
    )
      throw new DomainError(
        "validation",
        "Polygonens hörn måste vara skilda från varandra.",
      );
    for (let i = 0; i < p.length; i++)
      for (let j = i + 2; j < p.length; j++)
        if (
          !(i === 0 && j === p.length - 1) &&
          (intersects(
            p[i],
            p[(i + 1) % p.length],
            p[j],
            p[(j + 1) % p.length],
          ) ||
            onSegment(p[j], p[i], p[(i + 1) % p.length]) ||
            onSegment(p[(j + 1) % p.length], p[i], p[(i + 1) % p.length]) ||
            onSegment(p[i], p[j], p[(j + 1) % p.length]) ||
            onSegment(p[(i + 1) % p.length], p[j], p[(j + 1) % p.length]))
        )
          throw new DomainError(
            "validation",
            "Polygonens kanter får inte korsa varandra.",
          );
  }
}
export function validateRecords(records: RecordData[]) {
  if (
    !Array.isArray(records) ||
    records.some((r) => !r || typeof r !== "object")
  )
    throw new DomainError("validation", "Ogiltiga poster.");
  const map = new Map(records.map((r) => [r.id, r]));
  if (map.size !== records.length)
    throw new DomainError("validation", "Dubbla ID:n i filen.");
  const fail = (s: string): never => {
    throw new DomainError("validation", s);
  };
  if (records.filter((r) => r.kind === "workspace").length !== 1)
    fail("En lokal arbetsyta måste ha exakt en arbetsytepost.");
  for (const r of records) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        r.id,
      ) ||
      ![
        "workspace",
        "garden",
        "object",
        "plant",
        "planting",
        "placement",
        "event",
      ].includes(r.kind) ||
      typeof r.name !== "string" ||
      typeof r.notes !== "string" ||
      typeof r.archived !== "boolean" ||
      !Number.isInteger(r.revision) ||
      r.revision < 0 ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      !Number.isFinite(Date.parse(r.updatedAt))
    )
      fail("Ogiltig post eller metadata.");
    if (map.get(r.workspaceId)?.kind !== "workspace")
      fail("Arbetsytereferensen saknas.");
    const allowedKeys = [
      "id",
      "kind",
      "workspaceId",
      "revision",
      "createdAt",
      "updatedAt",
      "archived",
      "name",
      "notes",
      "gardenId",
      "geometry",
      "width",
      "height",
      "timezone",
      "category",
      "locked",
      "startDate",
      "endDate",
      "unknownStart",
      "layer",
      "plantId",
      "plantingId",
      "objectId",
      "count",
      "snapshot",
      "fields",
      "targetId",
      "date",
      "eventType",
      "quantity",
      "unit",
      "lastGardenId",
    ];
    if (Object.keys(r).some((key) => !allowedKeys.includes(key)))
      fail("Posten innehåller okända fält.");
    for (const key of ["unit", "category", "timezone", "lastGardenId"] as const)
      if (r[key] !== undefined && typeof r[key] !== "string")
        fail("Ogiltigt textfält.");
    for (const key of ["unknownStart", "locked"] as const)
      if (r[key] !== undefined && typeof r[key] !== "boolean")
        fail("Ogiltigt val.");
    if (r.snapshot && r.kind !== "planting")
      fail("Endast planteringar får ha katalogögonblicksbilder.");
    if (
      ["garden", "plant", "planting", "object"].includes(r.kind) &&
      !r.name.trim()
    )
      fail("Namn måste anges.");
    const ref = (id: string | undefined, kind: Kind) => {
      const v = id ? map.get(id) : undefined;
      if (!v || v.kind !== kind || v.workspaceId !== r.workspaceId)
        fail("Ogiltig referens.");
      return v!;
    };
    if (["object", "planting", "placement", "event"].includes(r.kind))
      ref(r.gardenId, "garden");
    if (
      r.kind === "garden" &&
      (!(r.width! > 0) ||
        !(r.height! > 0) ||
        !Number.isFinite(r.width) ||
        !Number.isFinite(r.height))
    )
      fail("Trädgårdens mått måste vara positiva.");
    for (const date of [r.startDate, r.endDate, r.date])
      if (date !== undefined && !validDate(date))
        fail("Ogiltigt kalenderdatum.");
    if (r.startDate && r.endDate && r.endDate <= r.startDate)
      fail("Sista dagen får inte ligga före startdatum.");
    if (r.kind === "object" || r.kind === "placement")
      validateGeometry(r.geometry!);
    if (r.kind === "planting") {
      ref(r.plantId, "plant");
      if (!Number.isInteger(r.count) || r.count! < 1)
        fail("Antal måste vara ett positivt heltal.");
      if (!r.snapshot || r.snapshot.kind !== "plant")
        fail("Växtens ögonblicksbild saknas.");
      if (
        r.snapshot!.id !== r.plantId ||
        r.snapshot!.workspaceId !== r.workspaceId
      )
        fail("Ogiltig katalogögonblicksbild.");
      validateRecords([map.get(r.workspaceId)!, r.snapshot!]);
    }
    if (r.kind === "placement") {
      if (r.layer !== "actual" || (!r.startDate && !r.unknownStart))
        fail("Ange startdatum eller välj befintlig växt med okänt startdatum.");
      if (r.unknownStart && r.startDate)
        fail("Välj antingen ett startdatum eller okänd start.");
      if (ref(r.plantingId, "planting").gardenId !== r.gardenId)
        fail("Planteringen tillhör en annan trädgård.");
      if (r.objectId && ref(r.objectId, "object").gardenId !== r.gardenId)
        fail("Ytan tillhör en annan trädgård.");
    }
    if (r.kind === "event") {
      const target = r.targetId ? map.get(r.targetId) : undefined;
      if (
        !target ||
        !["garden", "object", "planting"].includes(target.kind) ||
        (target.kind === "garden" ? target.id : target.gardenId) !==
          r.gardenId ||
        !r.date ||
        !eventTypes.includes(r.eventType!)
      )
        fail("Händelsen behöver giltigt datum, typ och ett mål i trädgården.");
      if (
        r.quantity !== undefined &&
        (!Number.isFinite(r.quantity) || r.quantity < 0)
      )
        fail("Mängden måste vara positiv.");
    }
    if (r.fields && Object.values(r.fields).some((v) => typeof v !== "string"))
      fail("Ogiltiga växtfält.");
    if (r.kind === "plant" && r.fields) {
      for (const key of [
        "Sådjup (cm)",
        "Plantavstånd (cm)",
        "Radavstånd (cm)",
        "Höjd (cm)",
        "Bredd (cm)",
        "Groning min (dagar)",
        "Groning max (dagar)",
        "Skörd min (dagar)",
        "Skörd max (dagar)",
      ]) {
        const v = r.fields[key];
        if (v && (!Number.isFinite(numberValue(v)) || numberValue(v) < 0))
          fail(`${key} måste vara ett positivt tal eller lämnas tomt.`);
      }
      for (const key of ["Groning", "Skörd"]) {
        const min = r.fields[`${key} min (dagar)`],
          max = r.fields[`${key} max (dagar)`];
        if (min && max && numberValue(min) > numberValue(max))
          fail(`${key}: min får inte överstiga max.`);
        if ((min || max) && !r.fields[`${key} räknas från`]?.trim())
          fail(
            `Ange vad ${key.toLowerCase()} räknas från, exempelvis sådd eller utplantering.`,
          );
      }
    }
  }
  const placements = records.filter(
    (r) => r.kind === "placement" && !r.archived,
  );
  const groups = new Map<string, RecordData[]>();
  for (const p of placements) {
    const same = groups.get(p.plantingId!) || [];
    if (same.some((q) => periodsOverlap(p, q)))
      fail("Samma plantering får inte ha överlappande placeringsperioder.");
    same.push(p);
    groups.set(p.plantingId!, same);
  }
}
export function parseSnapshot(value: unknown): Snapshot {
  const s = value as Snapshot;
  if (
    !s ||
    s.schemaVersion !== 1 ||
    !["garden", "workspace"].includes(s.exportKind) ||
    !Array.isArray(s.records) ||
    !Number.isFinite(Date.parse(s.exportedAt))
  )
    throw new DomainError(
      "validation",
      "Ogiltigt exportformat eller okänd formatversion.",
    );
  if (
    s.records.filter((r) => r.kind === "workspace").length !== 1 ||
    (s.exportKind === "garden" &&
      s.records.filter((r) => r.kind === "garden").length !== 1)
  )
    throw new DomainError(
      "validation",
      "Filen måste innehålla en arbetsyta och rätt antal trädgårdar.",
    );
  validateRecords(s.records);
  if (s.histories !== undefined) {
    if (s.exportKind !== "workspace" || !Array.isArray(s.histories))
      throw new DomainError("validation", "Ogiltig ångerhistorik.");
    const records = new Map(s.records.map((r) => [r.id, r]));
    for (const h of s.histories) {
      if (
        !h ||
        records.get(h.id)?.kind !== "garden" ||
        !Array.isArray(h.undo) ||
        !Array.isArray(h.redo)
      )
        throw new DomainError("validation", "Ogiltig ångerhistorik.");
      for (const command of [...h.undo, ...h.redo]) {
        if (!Array.isArray(command))
          throw new DomainError("validation", "Ogiltigt historikkommando.");
        for (const c of command) {
          const current = records.get(c?.after?.id);
          if (
            !current ||
            current.kind !== c.after.kind ||
            (c.before && c.before.id !== c.after.id) ||
            c.after.workspaceId !== current.workspaceId ||
            (current.id !== h.id &&
              current.gardenId !== h.id &&
              current.kind !== "plant")
          )
            throw new DomainError(
              "validation",
              "Historiken har ogiltiga referenser.",
            );
        }
      }
    }
  }
  return s;
}
