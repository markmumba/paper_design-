// Generators for fine engraving-style detail: wood grain, lashings, rope, rivets,
// stipple and dimension lines. Everything returns plain SVG path strings and is
// deterministic (seeded) so server and client render the same marks.

const f = (n: number) => Math.round(n * 100) / 100;

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function frame(x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  // Point at distance `a` along the member and `b` across it.
  const at = (a: number, b: number): [number, number] => [x1 + ux * a - uy * b, y1 + uy * a + ux * b];
  return { len, ux, uy, at };
}

/**
 * Wood grain running along a member from (x1,y1) to (x2,y2) of the given width:
 * wavering lines, a few that end early, and the occasional knot.
 */
export function grainAlong(x1: number, y1: number, x2: number, y2: number, width: number, lines = 4, seed = 1, knots = 1) {
  const r = rng(seed);
  const { len, at } = frame(x1, y1, x2, y2);
  let d = "";
  const knotAt: [number, number][] = Array.from({ length: knots }, () => [len * (0.2 + r() * 0.6), (r() - 0.5) * width * 0.4]);
  for (let i = 0; i < lines; i++) {
    const off = ((i + 0.5) / lines - 0.5) * width * 0.86;
    const start = r() < 0.3 ? r() * len * 0.3 : 0;
    const end = r() < 0.3 ? len - r() * len * 0.3 : len;
    const segs = Math.max(3, Math.round((end - start) / 14));
    for (let s = 0; s <= segs; s++) {
      const a = start + ((end - start) * s) / segs;
      let b = off + (r() - 0.5) * width * 0.06;
      // Grain bends around knots.
      for (const [ka, kb] of knotAt) {
        const dist = Math.abs(a - ka);
        if (dist < width * 1.6) b += Math.sign(off - kb || 1) * (1 - dist / (width * 1.6)) * width * 0.18;
      }
      const [px, py] = at(a, b);
      d += `${s ? "L" : "M"}${f(px)} ${f(py)}`;
    }
  }
  for (const [ka, kb] of knotAt) {
    const [kx, ky] = at(ka, kb);
    const rr = width * 0.12;
    d += ellipseAt(kx, ky, rr * 1.8, rr) + ellipseAt(kx, ky, rr * 0.8, rr * 0.45);
  }
  return d;
}

function ellipseAt(cx: number, cy: number, rx: number, ry: number) {
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
}

/** Both edges of a member as two parallel lines. */
export function member(x1: number, y1: number, x2: number, y2: number, width: number) {
  const { len, at } = frame(x1, y1, x2, y2);
  const [ax, ay] = at(0, -width / 2);
  const [bx, by] = at(len, -width / 2);
  const [cx, cy] = at(len, width / 2);
  const [dx, dy] = at(0, width / 2);
  return `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}M${f(dx)} ${f(dy)}L${f(cx)} ${f(cy)}`;
}

/** Rope lashing wrapped around a member: slanted turns between a start and end. */
export function lash(x1: number, y1: number, x2: number, y2: number, width: number, turns = 6) {
  const { len, at } = frame(x1, y1, x2, y2);
  let d = "";
  for (let i = 0; i <= turns; i++) {
    const a = (len * i) / turns;
    const [p1x, p1y] = at(a - 1.5, -width / 2 - 1);
    const [p2x, p2y] = at(a + 1.5, width / 2 + 1);
    d += `M${f(p1x)} ${f(p1y)}L${f(p2x)} ${f(p2y)}`;
  }
  return d;
}

/** Twisted rope: two interleaved strands plus the lay of the twist. */
export function rope(x1: number, y1: number, x2: number, y2: number, thick = 2.4, pitch = 5) {
  const { len, at } = frame(x1, y1, x2, y2);
  const n = Math.max(4, Math.round(len / pitch));
  let a = "";
  let b = "";
  let ticks = "";
  for (let i = 0; i <= n * 2; i++) {
    const s = (len * i) / (n * 2);
    const w = Math.sin((i / 2) * Math.PI) * thick * 0.5;
    const [ax, ay] = at(s, w);
    const [bx, by] = at(s, -w);
    a += `${i ? "L" : "M"}${f(ax)} ${f(ay)}`;
    b += `${i ? "L" : "M"}${f(bx)} ${f(by)}`;
    if (i % 2 === 0) {
      const [t1x, t1y] = at(s - pitch * 0.25, -thick * 0.5);
      const [t2x, t2y] = at(s + pitch * 0.25, thick * 0.5);
      ticks += `M${f(t1x)} ${f(t1y)}L${f(t2x)} ${f(t2y)}`;
    }
  }
  return a + b + ticks;
}

/** A row of rivets or nail heads: a ring with a centre dot. */
export function rivets(x1: number, y1: number, x2: number, y2: number, n: number, r = 1.4) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    d += `M${f(x - r)} ${f(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0M${f(x)} ${f(y)}h0.01`;
  }
  return d;
}

/** Rivets placed at arbitrary points. */
export function rivetsAt(pts: [number, number][], r = 1.4) {
  return pts.map(([x, y]) => rivets(x, y, x, y, 1, r)).join("");
}

/** Stipple dots scattered in an ellipse, denser towards the centre. */
export function stipple(cx: number, cy: number, rx: number, ry: number, n: number, seed = 3) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const k = r() * r();
    d += `M${f(cx + Math.cos(a) * k * rx)} ${f(cy + Math.sin(a) * k * ry)}h0.01`;
  }
  return d;
}

/** Hatching lines at an angle filling a box; pair with a clipPath for shapes. */
export function hatchBox(x: number, y: number, w: number, h: number, gap: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const diag = Math.hypot(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  let d = "";
  for (let o = -diag / 2; o <= diag / 2; o += gap) {
    const px = cx - uy * o;
    const py = cy + ux * o;
    d += `M${f(px - ux * diag)} ${f(py - uy * diag)}L${f(px + ux * diag)} ${f(py + uy * diag)}`;
  }
  return d;
}

/** Engineering-style dimension line with extension lines and tick marks. */
export function dimension(x1: number, y1: number, x2: number, y2: number, offset: number) {
  const { len, at } = frame(x1, y1, x2, y2);
  const [a1x, a1y] = at(0, 0);
  const [b1x, b1y] = at(0, offset * 1.15);
  const [a2x, a2y] = at(len, 0);
  const [b2x, b2y] = at(len, offset * 1.15);
  const [l1x, l1y] = at(0, offset);
  const [l2x, l2y] = at(len, offset);
  const tick = (a: number) => {
    const [px, py] = at(a - 3, offset + 3);
    const [qx, qy] = at(a + 3, offset - 3);
    return `M${f(px)} ${f(py)}L${f(qx)} ${f(qy)}`;
  };
  // Small marks every tenth, like a ruled measure.
  let marks = "";
  for (let i = 1; i < 10; i++) {
    const [mx, my] = at((len * i) / 10, offset);
    const [nx, ny] = at((len * i) / 10, offset + (i === 5 ? -4 : -2));
    marks += `M${f(mx)} ${f(my)}L${f(nx)} ${f(ny)}`;
  }
  const [mx, my] = at(len / 2, offset);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    d:
      `M${f(a1x)} ${f(a1y)}L${f(b1x)} ${f(b1y)}M${f(a2x)} ${f(a2y)}L${f(b2x)} ${f(b2y)}` +
      `M${f(l1x)} ${f(l1y)}L${f(l2x)} ${f(l2y)}` +
      tick(0) +
      tick(len) +
      marks,
    mid: [mx, my] as [number, number],
    angle,
  };
}

/** Pebbles and grass tufts along a ground line. */
export function groundLitter(x1: number, x2: number, y: number, seed = 9, n = 40) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = x1 + r() * (x2 - x1);
    const kind = r();
    if (kind < 0.45) {
      const rx = 1 + r() * 2.5;
      d += ellipseAt(x, y + 2 + r() * 10, rx, rx * 0.55);
    } else if (kind < 0.75) {
      const h = 3 + r() * 6;
      d += `M${f(x)} ${f(y)}q${f(-1 - r() * 2)} ${f(-h * 0.6)} ${f(-2 - r() * 2)} ${f(-h)}M${f(x)} ${f(y)}q${f(0.5)} ${f(-h * 0.7)} ${f(1 + r())} ${f(-h * 1.1)}M${f(x)} ${f(y)}q${f(1 + r() * 2)} ${f(-h * 0.5)} ${f(3 + r() * 2)} ${f(-h * 0.8)}`;
    } else {
      d += `M${f(x)} ${f(y + 3 + r() * 12)}h0.01`;
    }
  }
  return d;
}

/** Concentric rings, e.g. a pulley groove or a gear rim. */
export function rings(cx: number, cy: number, radii: number[]) {
  return radii.map((r) => ellipseAt(cx, cy, r, r)).join("");
}

/** Short radial ticks around a circle (wheel treads, gear hub marks). */
export function radialTicks(cx: number, cy: number, r1: number, r2: number, n: number, offset = 0) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = offset + (i * Math.PI * 2) / n;
    d += `M${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)}L${f(cx + Math.cos(a) * r2)} ${f(cy + Math.sin(a) * r2)}`;
  }
  return d;
}

/** Point on an ellipse (for hoops, rims and seams in perspective). */
export const onEllipse = (cx: number, cy: number, rx: number, ry: number, th: number): [number, number] => [
  cx + Math.cos(th) * rx,
  cy + Math.sin(th) * ry,
];

/** Partial ellipse arc sampled as a polyline from th1 to th2. */
export function arcPoly(cx: number, cy: number, rx: number, ry: number, th1: number, th2: number, steps = 24) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const [x, y] = onEllipse(cx, cy, rx, ry, th1 + ((th2 - th1) * i) / steps);
    d += `${i ? "L" : "M"}${f(x)} ${f(y)}`;
  }
  return d;
}

// ── Hairline fibres ─────────────────────────────────────────────────────────
// Sub-pixel wood fibres and pores, only really visible under the magnifier.

type Pt = [number, number];

export function sampleQuad(a: Pt, c: Pt, b: Pt, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
}

export function sampleCubic(a: Pt, c1: Pt, c2: Pt, b: Pt, n = 32): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [k[0] * a[0] + k[1] * c1[0] + k[2] * c2[0] + k[3] * b[0], k[0] * a[1] + k[1] * c1[1] + k[2] * c2[1] + k[3] * b[1]];
  });
}

/**
 * Broken hairline fibres running along a centre polyline, `w1` wide at the
 * start tapering to `w2` at the end, plus scattered pores.
 */
export function fibers(pts: Pt[], w1: number, w2 = w1, seed = 1, spacing = 0.7) {
  const r = rng(seed);
  // Arc-length table for the polyline.
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L < 1) return "";
  let seg = 1;
  const frameAt = (s: number) => {
    if (s < cum[seg - 1]) seg = 1;
    while (seg < pts.length - 1 && cum[seg] < s) seg++;
    const [ax, ay] = pts[seg - 1];
    const [bx, by] = pts[seg];
    const len = cum[seg] - cum[seg - 1] || 1;
    const t = (s - cum[seg - 1]) / len;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx: -(by - ay) / len, ny: (bx - ax) / len };
  };
  const width = (s: number) => w1 + ((w2 - w1) * s) / L;

  let d = "";
  const lanes = Math.max(2, Math.round(Math.max(w1, w2) / spacing));
  for (let j = 0; j < lanes; j++) {
    const u = (j + 0.5) / lanes - 0.5;
    let s = r() * 3;
    seg = 1;
    while (s < L) {
      const dash = 3 + r() * 12;
      const end = Math.min(L, s + dash);
      const jitter = (r() - 0.5) * spacing * 0.5;
      let first = true;
      for (let q = s; q <= end + 0.01; q += 4) {
        const fr = frameAt(Math.min(q, end));
        const off = u * width(q) * 0.92 + jitter + Math.sin(q * 0.35 + j) * spacing * 0.12;
        d += `${first ? "M" : "L"}${f(fr.x + fr.nx * off)} ${f(fr.y + fr.ny * off)}`;
        first = false;
      }
      s = end + 0.4 + r() * 2.5;
    }
  }
  // Pores: tiny elongated flecks.
  const pores = Math.round((L * Math.max(w1, w2)) / 28);
  seg = 1;
  const flecks: number[] = Array.from({ length: pores }, () => r() * L).sort((a, b) => a - b);
  for (const s of flecks) {
    const fr = frameAt(s);
    const off = (r() - 0.5) * width(s) * 0.85;
    const x = fr.x + fr.nx * off;
    const y = fr.y + fr.ny * off;
    d += `M${f(x)} ${f(y)}l${f(fr.ny * 0.8)} ${f(-fr.nx * 0.8)}`;
  }
  return d;
}

/** Fibres along a straight member. */
export const fibersLine = (x1: number, y1: number, x2: number, y2: number, w1: number, w2 = w1, seed = 1, spacing = 0.7) =>
  fibers(
    [
      [x1, y1],
      [x2, y2],
    ],
    w1,
    w2,
    seed,
    spacing,
  );

/** Shift a sampled curve sideways (to centre fibres between a member's two edges). */
export const nudge = (pts: Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [x + dx, y + dy]);
