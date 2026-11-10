// Small helpers for building SVG path strings by hand.

const r2 = (n: number) => Math.round(n * 100) / 100;

export const circle = (cx: number, cy: number, r: number) =>
  `M${r2(cx - r)} ${r2(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r2(cx - rx)} ${r2(cy)}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

/** Lower (front) or upper (back) half of an ellipse, drawn left to right. */
export const halfEllipse = (cx: number, cy: number, rx: number, ry: number, front = true) =>
  `M${r2(cx - rx)} ${r2(cy)}a${rx} ${ry} 0 0 ${front ? 0 : 1} ${2 * rx} 0`;

export const line = (x1: number, y1: number, x2: number, y2: number) =>
  `M${r2(x1)} ${r2(y1)}L${r2(x2)} ${r2(y2)}`;

export const poly = (pts: [number, number][], close = false) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${r2(x)} ${r2(y)}`).join("") + (close ? "Z" : "");

/** Spur gear outline centred on (cx, cy). Rotate it with a transform. */
export function gear(cx: number, cy: number, r: number, teeth: number, depth = r * 0.14) {
  const step = (Math.PI * 2) / teeth;
  const pts: [number, number][] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const at = (ang: number, rad: number): [number, number] => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
    pts.push(at(a, r - depth), at(a + step * 0.18, r), at(a + step * 0.48, r), at(a + step * 0.66, r - depth));
  }
  return poly(pts, true);
}

/** Spokes radiating from a hub. */
export function spokes(cx: number, cy: number, r: number, n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = offset + (i * Math.PI * 2) / n;
    return line(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }).join("");
}

/** Parallel hatching strokes between two points, sketch-style shading. */
export function hatch(x: number, y: number, count: number, gap: number, dx: number, dy: number) {
  return Array.from({ length: count }, (_, i) => line(x + i * gap, y, x + i * gap + dx, y + dy)).join("");
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Map v from [a, b] to [0, 1], clamped. */
export const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeIn = (t: number) => t * t * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
