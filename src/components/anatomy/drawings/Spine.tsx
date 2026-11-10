"use client";

import type { MachineProps } from "@/components/Exhibit";
import { Ink, InkSet, Micro, Note, Tone } from "@/components/ink";
import { line } from "@/lib/geo";
import { sampleCubic } from "@/lib/detail";

/*
 * Our redrawing after Leonardo's vertebral column (c. 1510–11), seen from the
 * side, front to the right: seven vertebrae of the neck, twelve of the back,
 * five of the loins, then the sacrum and tailbone, on the column's four
 * curves. And, as on his sheet, one spine too many in the upper back.
 */

type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

// The column's centre line, crown of the neck to the tailbone.
const AXIS: Pt[] = [
  ...sampleCubic([300, 46], [318, 70], [322, 104], [312, 132], 20), // neck, curving forward
  ...sampleCubic([312, 132], [292, 180], [268, 240], [292, 288], 30).slice(1), // back, curving behind
  ...sampleCubic([292, 288], [318, 318], [328, 350], [306, 382], 20).slice(1), // loins, forward again
  ...sampleCubic([306, 382], [288, 404], [278, 424], [292, 446], 14).slice(1), // sacrum, behind
];

function lengths(pts: Pt[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}
const CUM = lengths(AXIS);
const TOTAL = CUM[CUM.length - 1];
function at(s: number) {
  let i = 0;
  while (i < CUM.length - 2 && CUM[i + 1] < s) i++;
  const t = (s - CUM[i]) / Math.max(1e-6, CUM[i + 1] - CUM[i]);
  const [a, b] = [AXIS[i], AXIS[i + 1]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  // Tangent, and the normal pointing to the front (+x side).
  const tx = dx / l;
  const ty = dy / l;
  let nx = -ty;
  let ny = tx;
  if (nx < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: a[0] + dx * t, y: a[1] + dy * t, tx, ty, nx, ny };
}

type Region = { n: number; h: number; body: number; spine: number; droop: number };
const REGIONS: Region[] = [
  { n: 7, h: 11.5, body: 14, spine: 16, droop: 0.25 }, // neck
  { n: 12, h: 14, body: 18, spine: 26, droop: 0.9 }, // back: long spines slanting down
  { n: 5, h: 19, body: 26, spine: 22, droop: 0.2 }, // loins: big bodies, square spines
];

type Vert = { body: string; spine: string; disc: string; c: { x: number; y: number; nx: number } };
const verts: Vert[] = [];
{
  const span = REGIONS.reduce((a, r) => a + r.n * r.h, 0);
  const sacrum = 64;
  const scale = (TOTAL - sacrum) / span;
  let s = 0;
  for (const r of REGIONS) {
    for (let k = 0; k < r.n; k++) {
      const h = r.h * scale;
      const m = at(s + h / 2);
      const top = at(s + h * 0.1);
      const bot = at(s + h * 0.9);
      // The body sits in front of the canal; the spine reaches back from it.
      const f = (q: typeof m, d: number): Pt => [q.x + q.nx * d, q.y + q.ny * d];
      const [a, b, c, d] = [f(top, 2), f(top, r.body + 2), f(bot, r.body + 2), f(bot, 2)];
      const body = `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}Q${r1(b[0] + m.nx * 2)} ${r1((b[1] + c[1]) / 2)} ${r1(c[0])} ${r1(c[1])}L${r1(d[0])} ${r1(d[1])}`;
      // Spinous process: back and down, a blade with a rounded tip.
      const base = f(m, -5);
      const dir: Pt = [-m.nx + m.tx * r.droop, -m.ny + m.ty * r.droop];
      const dl = Math.hypot(...dir);
      const tip: Pt = [base[0] + (dir[0] / dl) * r.spine, base[1] + (dir[1] / dl) * r.spine];
      const spine = `M${r1(base[0] + m.tx * -h * 0.3)} ${r1(base[1] + m.ty * -h * 0.3)}L${r1(tip[0])} ${r1(tip[1])}L${r1(base[0] + m.tx * h * 0.3)} ${r1(base[1] + m.ty * h * 0.3)}`;
      const dq = at(s + h);
      const disc = `M${r1(dq.x + dq.nx * 3)} ${r1(dq.y + dq.ny * 3)}L${r1(dq.x + dq.nx * (r.body + 1))} ${r1(dq.y + dq.ny * (r.body + 1))}`;
      verts.push({ body, spine, disc, c: m });
      s += h;
    }
  }
}
const BODIES = verts.map((v) => v.body);
const SPINES = verts.map((v) => v.spine).join("");
const DISCS = verts.map((v) => v.disc).join("");
const CANAL = (() => {
  const back = AXIS.filter((_, i) => i % 2 === 0)
    .map(([x, y], i) => `${i ? "L" : "M"}${r1(x - 1)} ${r1(y)}`)
    .join("");
  return back;
})();
// The sacrum: a curved wedge of fused bone, and the little tailbone below.
const SACRUM = "M318 384Q300 408 292 434Q290 444 296 450L304 446Q306 420 330 392Z";
const COCCYX = "M296 450Q298 460 302 466M300 448Q304 458 306 462";

// His slip: a thirteenth spine between the second and third of the back.
const extra = (() => {
  const v2 = verts[7 + 1].c;
  const v3 = verts[7 + 2].c;
  const m = { x: (v2.x + v3.x) / 2, y: (v2.y + v3.y) / 2, nx: (v2.nx + v3.nx) / 2 };
  return `M${r1(m.x - 5)} ${r1(m.y - 2)}L${r1(m.x - 30)} ${r1(m.y + 14)}L${r1(m.x - 5)} ${r1(m.y + 3)}`;
})();
const EXTRA_AT = verts[8].c;

// The four curves, traced in the spot colour just in front of the bodies.
const CURVE = AXIS.filter((_, i) => i % 2 === 0)
  .map(([x, y], i) => `${i ? "L" : "M"}${r1(x + 44)} ${r1(y)}`)
  .join("");

export function Spine({ p }: MachineProps) {
  const neck = verts[3].c;
  const back = verts[13].c;
  const loins = verts[21].c;
  return (
    <>
      <Ink d={line(150, 470, 450, 470)} p={p} from={0.02} to={0.06} w={0.5} opacity={0.3} />
      <Ink d={CANAL} p={p} from={0.02} to={0.1} w={0.5} opacity={0.5} />
      <InkSet paths={BODIES} p={p} from={0.04} to={0.3} w={1.2} />
      <Tone d={BODIES.join("") + "Z"} p={p} from={0.2} to={0.3} density={15} />
      <Ink d={SPINES} p={p} from={0.12} to={0.32} w={1} />
      <Ink d={DISCS} p={p} from={0.26} to={0.34} w={0.5} opacity={0.7} />
      <Tone d={SACRUM} p={p} from={0.3} to={0.36} density={30} />
      <Ink d={SACRUM + COCCYX} p={p} from={0.28} to={0.36} w={1.2} />

      {/* The four curves. */}
      <g className="spot-layer text-spot">
        <Ink d={CURVE} p={p} from={0.4} to={0.6} w={1.1} />
      </g>
      <Note p={p} from={0.44} x1={neck.x + 20} y1={neck.y} x2={470} y2={70} text="sette del collo" />
      <Note p={p} from={0.5} x1={back.x + 20} y1={back.y} x2={470} y2={210} text="dodici del dorso" />
      <Note p={p} from={0.56} x1={loins.x + 30} y1={loins.y} x2={470} y2={330} text="cinque dei lombi" />
      <Note p={p} from={0.6} x1={300} y1={420} x2={430} y2={440} text="l’osso sacro" />

      {/* And the extra spine he drew. */}
      <g className="spot-layer text-spot">
        <Ink d={extra} p={p} from={0.72} to={0.78} w={1.3} />
      </g>
      <Note p={p} from={0.76} x1={EXTRA_AT.x - 28} y1={EXTRA_AT.y + 10} x2={250} y2={140} text="una spina di troppo" anchor="end" />

      <Micro p={p} from={0.3} x={24} y={300} size={5} lines={["La spina ha quattro", "piegature, e ventiquattro", "vertebre sopra l’osso sacro."]} />
    </>
  );
}
