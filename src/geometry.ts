import type { Geometry, Point } from "./domain";

// Numerical tolerance in normalized geometry, not a polygonal approximation of curves.
const EPS = 1e-10;
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function world(p: Point, g: Geometry): Point {
  const a = (g.rotation * Math.PI) / 180;
  return {
    x: g.x + p.x * Math.cos(a) - p.y * Math.sin(a),
    y: g.y + p.x * Math.sin(a) + p.y * Math.cos(a),
  };
}
function outline(g: Geometry): Point[] {
  return (
    g.shape === "polygon"
      ? g.points!
      : [
          { x: 0, y: 0 },
          { x: g.width, y: 0 },
          { x: g.width, y: g.height },
          { x: 0, y: g.height },
        ]
  ).map((p) => world(p, g));
}
function unit(p: Point, g: Geometry): Point {
  const a = (g.rotation * Math.PI) / 180,
    dx = p.x - g.x,
    dy = p.y - g.y;
  return {
    x: (2 * (dx * Math.cos(a) + dy * Math.sin(a))) / g.width - 1,
    y: (2 * (-dx * Math.sin(a) + dy * Math.cos(a))) / g.height - 1,
  };
}
function segmentDistance(p: Point, a: Point, b: Point) {
  const d = sub(b, a),
    t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
  const v = { x: a.x + t * d.x - p.x, y: a.y + t * d.y - p.y };
  return dot(v, v);
}
function inside(p: Point, poly: Point[], boundary = true) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (segmentDistance(p, a, b) < EPS * EPS) return boundary;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}

function triangles(poly: Point[]): Point[][] {
  const points = [...poly];
  const area = points.reduce(
    (sum, p, i) =>
      sum +
      p.x * points[(i + 1) % points.length].y -
      p.y * points[(i + 1) % points.length].x,
    0,
  );
  if (area < 0) points.reverse();
  const result: Point[][] = [];
  while (points.length > 3) {
    let found = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length],
        b = points[i],
        c = points[(i + 1) % points.length];
      if (Math.abs(cross(a, b, c)) < EPS) {
        points.splice(i, 1);
        found = true;
        break;
      }
      if (
        cross(a, b, c) > 0 &&
        !points.some(
          (p) => p !== a && p !== b && p !== c && inside(p, [a, b, c]),
        )
      ) {
        result.push([a, b, c]);
        points.splice(i, 1);
        found = true;
        break;
      }
    }
    if (!found) throw new Error("Polygonen kunde inte trianguleras.");
  }
  if (points.length === 3) result.push(points);
  return result;
}
function triangleOverlap(a: Point[], b: Point[]) {
  for (const poly of [a, b])
    for (let i = 0; i < 3; i++) {
      const edge = sub(poly[(i + 1) % 3], poly[i]),
        length = Math.hypot(edge.x, edge.y),
        axis = { x: -edge.y / length, y: edge.x / length };
      const x = a.map((p) => dot(p, axis)),
        y = b.map((p) => dot(p, axis));
      if (
        Math.min(Math.max(...x), Math.max(...y)) -
          Math.max(Math.min(...x), Math.min(...y)) <=
        EPS
      )
        return false;
    }
  return true;
}
function ellipsePolygon(ellipse: Geometry, poly: Point[]) {
  const points = poly.map((p) => unit(p, ellipse));
  return (
    inside({ x: 0, y: 0 }, points) ||
    points.some(
      (p, i) =>
        segmentDistance({ x: 0, y: 0 }, p, points[(i + 1) % points.length]) <
        1 - EPS,
    )
  );
}

// Express the second ellipse as c + M*u in the first ellipse's unit disk.
function ellipseTransform(outer: Geometry, inner: Geometry) {
  const center = world({ x: inner.width / 2, y: inner.height / 2 }, inner),
    c = unit(center, outer);
  const x = sub(
      unit(world({ x: inner.width, y: inner.height / 2 }, inner), outer),
      c,
    ),
    y = sub(
      unit(world({ x: inner.width / 2, y: inner.height }, inner), outer),
      c,
    );
  return {
    c,
    x,
    y,
    a: dot(x, x),
    b: dot(x, y),
    d: dot(y, y),
    q: { x: dot(x, c), y: dot(y, c) },
  };
}
function ellipseMinimum(a: Geometry, b: Geometry) {
  const t = ellipseTransform(a, b),
    { c, x, y, q } = t;
  const solve = (lambda: number): Point => {
    const aa = t.a + lambda,
      dd = t.d + lambda,
      det = aa * dd - t.b * t.b;
    return {
      x: -(dd * q.x - t.b * q.y) / det,
      y: -(aa * q.y - t.b * q.x) / det,
    };
  };
  let u = solve(0);
  if (dot(u, u) <= 1) return 0;
  let high = 1;
  while (dot(solve(high), solve(high)) > 1) high *= 2;
  let low = 0;
  for (let i = 0; i < 90; i++) {
    const mid = (low + high) / 2;
    u = solve(mid);
    if (dot(u, u) > 1) low = mid;
    else high = mid;
  }
  u = solve(high);
  const p = { x: c.x + x.x * u.x + y.x * u.y, y: c.y + x.y * u.x + y.y * u.y };
  return dot(p, p);
}
function ellipseMaximum(outer: Geometry, inner: Geometry) {
  const t = ellipseTransform(outer, inner),
    angle = 0.5 * Math.atan2(2 * t.b, t.a - t.d),
    v = { x: Math.cos(angle), y: Math.sin(angle) },
    w = { x: -v.y, y: v.x };
  const h = (t.a + t.d + Math.hypot(t.a - t.d, 2 * t.b)) / 2,
    l = (t.a + t.d - Math.hypot(t.a - t.d, 2 * t.b)) / 2,
    qh = dot(t.q, v),
    ql = dot(t.q, w);
  let uh: number, ul: number;
  if (Math.abs(qh) < EPS && h - l > EPS && Math.abs(ql / (h - l)) <= 1) {
    ul = ql / (h - l);
    uh = Math.sqrt(1 - ul * ul);
  } else if (Math.hypot(qh, ql) < EPS) {
    uh = 1;
    ul = 0;
  } else {
    const norm = (lambda: number) =>
      (qh / (lambda - h)) ** 2 + (ql / (lambda - l)) ** 2;
    let low = h,
      high = h + Math.max(1, Math.hypot(qh, ql));
    while (norm(high) > 1) high = h + 2 * (high - h);
    for (let i = 0; i < 90; i++) {
      const mid = (low + high) / 2;
      if (norm(mid) > 1) low = mid;
      else high = mid;
    }
    uh = qh / (high - h);
    ul = ql / (high - l);
  }
  const u = { x: v.x * uh + w.x * ul, y: v.y * uh + w.y * ul },
    p = {
      x: t.c.x + t.x.x * u.x + t.y.x * u.y,
      y: t.c.y + t.x.y * u.x + t.y.y * u.y,
    };
  return dot(p, p);
}
export function overlaps(a: Geometry, b: Geometry): boolean {
  if (a.shape === "ellipse" && b.shape === "ellipse")
    return ellipseMinimum(a, b) < 1 - EPS;
  if (a.shape === "ellipse") return ellipsePolygon(a, outline(b));
  if (b.shape === "ellipse") return ellipsePolygon(b, outline(a));
  const x = triangles(outline(a)),
    y = triangles(outline(b));
  return x.some((p) => y.some((q) => triangleOverlap(p, q)));
}
export function bounds(g: Geometry) {
  if (g.shape === "ellipse") {
    const center = world({ x: g.width / 2, y: g.height / 2 }, g),
      a = (g.rotation * Math.PI) / 180,
      dx = Math.hypot(
        (g.width / 2) * Math.cos(a),
        (g.height / 2) * Math.sin(a),
      ),
      dy = Math.hypot(
        (g.width / 2) * Math.sin(a),
        (g.height / 2) * Math.cos(a),
      );
    return {
      minX: center.x - dx,
      maxX: center.x + dx,
      minY: center.y - dy,
      maxY: center.y + dy,
    };
  }
  const points = outline(g);
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export function containsShape(parent: Geometry, child: Geometry): boolean {
  if (parent.shape === "ellipse") {
    if (child.shape === "ellipse")
      return ellipseMaximum(parent, child) <= 1 + EPS;
    return outline(child).every((p) => {
      const q = unit(p, parent);
      return dot(q, q) <= 1 + EPS;
    });
  }
  const poly = outline(parent);
  if (child.shape === "ellipse") {
    const points = poly.map((p) => unit(p, child));
    return (
      inside({ x: 0, y: 0 }, points) &&
      points.every(
        (p, i) =>
          segmentDistance({ x: 0, y: 0 }, p, points[(i + 1) % points.length]) >=
          1 - EPS,
      )
    );
  }
  const points = outline(child);
  if (!points.every((p) => inside(p, poly))) return false;
  return points.every((a, i) => {
    const b = points[(i + 1) % points.length],
      v = sub(b, a),
      cuts = [0, 1];
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j],
        d = poly[(j + 1) % poly.length],
        edge = sub(d, c),
        offset = sub(c, a),
        den = v.x * edge.y - v.y * edge.x;
      if (Math.abs(den) > EPS) {
        const t = (offset.x * edge.y - offset.y * edge.x) / den,
          u = (offset.x * v.y - offset.y * v.x) / den;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      } else if (Math.abs(cross(a, b, c)) < EPS) {
        for (const p of [c, d]) {
          const t = dot(sub(p, a), v) / dot(v, v);
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
    }
    cuts.sort((x, y) => x - y);
    return cuts
      .slice(1)
      .every((t, j) =>
        inside(
          {
            x: a.x + (v.x * (t + cuts[j])) / 2,
            y: a.y + (v.y * (t + cuts[j])) / 2,
          },
          poly,
        ),
      );
  });
}
