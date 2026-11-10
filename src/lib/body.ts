/*
 * Drawing the body in ink: limbs as tapered contours along a chain of joints,
 * with Leonardo-style hatching laid along one side.
 */

export type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Chaikin corner-cutting, so bends at elbows and knees read as flesh. */
function smooth(pts: Pt[], passes = 2): Pt[] {
  let out = pts;
  for (let k = 0; k < passes; k++) {
    const next: Pt[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [a, b] = [out[i], out[i + 1]];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** Points every `step` along a polyline. */
function resample(pts: Pt[], n: number): Pt[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const s = (L * i) / n;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}

/** Width along the limb from a profile of [t, width] stops, eased between stops. */
function widthAt(profile: Pt[], t: number) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [t0, w0] = profile[i];
    const [t1, w1] = profile[i + 1];
    if (t <= t1) {
      const u = (t - t0) / Math.max(1e-6, t1 - t0);
      const e = u * u * (3 - 2 * u);
      return w0 + (w1 - w0) * e;
    }
  }
  return profile[profile.length - 1][1];
}

/**
 * A limb: its contour (open at the root, rounded at the tip) and hatching
 * along the shaded side. `shade` is +1 or -1: which side the hatching falls.
 */
export function limb(joints: Pt[], profile: Pt[], shade = 1, n = 64) {
  const c = resample(smooth(joints), n);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const normals: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(n, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    normals.push([nx, ny]);
    const w = widthAt(profile, i / n) / 2;
    left.push([c[i][0] + nx * w, c[i][1] + ny * w]);
    right.push([c[i][0] - nx * w, c[i][1] - ny * w]);
  }
  const tip = c[n];
  const contour =
    `M${left.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}` +
    `Q${r1(tip[0] + (c[n][0] - c[n - 2][0]) * 1.2)} ${r1(tip[1] + (c[n][1] - c[n - 2][1]) * 1.2)} ` +
    `${r1(right[n][0])} ${r1(right[n][1])}` +
    `L${right
      .slice()
      .reverse()
      .map(([x, y]) => `${r1(x)} ${r1(y)}`)
      .join("L")}`;
  // Short parallel strokes inside the shaded edge, the way he modelled form.
  let hatch = "";
  const edge = shade > 0 ? left : right;
  for (let i = 3; i < n - 2; i += 2) {
    const w = widthAt(profile, i / n);
    const [nx, ny] = normals[i];
    const [ex, ey] = edge[i];
    const k = -shade * w * 0.38;
    hatch += `M${r1(ex - nx * shade * 0.8)} ${r1(ey - ny * shade * 0.8)}l${r1(nx * k + (c[i + 1][0] - c[i][0]) * 0.8)} ${r1(ny * k + (c[i + 1][1] - c[i][1]) * 0.8)}`;
  }
  return { contour, hatch };
}

/** Mirror a path's x coordinates about x = cx (for absolute-coordinate paths with M, L, Q, C only). */
export function mirrorX(d: string, cx: number) {
  return d.replace(/([MLQCT])([^MLQCTZz]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out = nums.map((v, i) => (i % 2 === 0 ? r1(2 * cx - v) : v));
    return `${cmd}${out.join(" ")}`;
  });
}

/** Solve f(x) = 0 on [a, b] by bisection (f must change sign). */
export function bisect(f: (x: number) => number, a: number, b: number) {
  let fa = f(a);
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}
