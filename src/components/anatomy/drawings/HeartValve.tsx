"use client";

import { motion, useTransform } from "motion/react";
import type { MachineProps } from "@/components/Exhibit";
import { Ink, InkSet, LivePath, Micro, Note, Tone } from "@/components/ink";
import { mirrorX } from "@/lib/body";
import { circle, easeInOut, line, range } from "@/lib/geo";

/*
 * Our redrawing after Leonardo's studies of the aortic valve (c. 1512–13).
 * Left: the valve seen from above, shut, half open and open, as he sketched
 * it. Right: a section through the root of the aorta. As you scroll, blood
 * flows out through the open valve, curls into eddies in the pouches (the
 * sinuses) behind its cusps, and the cusps swing shut: the eddies he
 * predicted, and that MRI showed in 2014.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;
const CX = 400;

// The wall of the aorta: straight above, swelling into a sinus at the valve.
const WALL_L = `M${CX - 58} 40L${CX - 58} 230C${CX - 58} 252 ${CX - 98} 262 ${CX - 98} 296C${CX - 98} 330 ${CX - 64} 344 ${CX - 56} 352L${CX - 56} 452`;
const WALL_R = mirrorX(WALL_L, CX);
const WALL_HATCH = Array.from({ length: 22 }, (_, i) => {
  const y = 50 + i * 18;
  if (y > 220 && y < 360) return "";
  return `M${CX - 58} ${y}l-8 6M${CX + 58} ${y}l8 6`;
}).join("");
const SINUS_SHADE_L = `M${CX - 58} 230C${CX - 58} 252 ${CX - 98} 262 ${CX - 98} 296C${CX - 98} 330 ${CX - 64} 344 ${CX - 56} 352L${CX - 70} 300Z`;

/** A cusp: from its hinge low on the wall, curving up to a free edge whose tip is set by `shut` (0 open, 1 closed). */
function cusp(side: 1 | -1, shut: number) {
  const hx = CX + side * 56;
  const hy = 352;
  const open = [CX + side * 48, 256];
  const closed = [CX + side * 2, 318];
  const tx = open[0] + (closed[0] - open[0]) * shut;
  const ty = open[1] + (closed[1] - open[1]) * shut;
  const cx = hx - side * (6 + 26 * shut);
  const cy = hy - 40 + 10 * shut;
  return `M${r1(hx)} ${hy}Q${r1(cx)} ${r1(cy)} ${r1(tx)} ${r1(ty)}`;
}

/** A spiral eddy of `turns` turns, rotated by `phase`. */
function eddy(cx: number, cy: number, r: number, turns: number, phase: number, dir: 1 | -1) {
  let d = "";
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = dir * (phase + t * turns * Math.PI * 2);
    const rr = r * (1 - t * 0.85);
    d += `${i ? "L" : "M"}${r1(cx + Math.cos(a) * rr)} ${r1(cy + Math.sin(a) * rr * 0.9)}`;
  }
  return d;
}

/** Streaks of blood rising through the valve, moving up with the phase. */
function streaks(phase: number, open: number) {
  let d = "";
  const lanes = [-30, -15, 0, 15, 30];
  for (const dx of lanes) {
    for (let k = 0; k < 6; k++) {
      const y = 440 - ((k * 70 + phase * 90) % 380);
      // Only through the opening while the valve is open.
      if (y > 300 && open < 0.3) continue;
      const len = 22 * (y < 300 ? 1 : open);
      if (len < 2) continue;
      const bend = y > 230 && y < 330 ? Math.sign(dx) * 4 * (1 - Math.abs(y - 280) / 60) : 0;
      d += `M${r1(CX + dx + bend)} ${r1(y)}l0 ${r1(-len)}`;
    }
  }
  return d;
}

// The valve from above: three cusps meeting in a Y (shut), a soft triangle
// (half open), a round opening (open). As in his small sketches.
const TOPS = [120, 240, 360].map((y, i) => {
  const R = 44;
  const ring = circle(110, y, R) + circle(110, y, R - 6);
  if (i === 0)
    return (
      ring +
      [0, 1, 2]
        .map((k) => {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
          return line(110, y, 110 + Math.cos(a) * (R - 6), y + Math.sin(a) * (R - 6));
        })
        .join("")
    );
  const g = i === 1 ? 0.45 : 0.85;
  const pts = [0, 1, 2].map((k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
    return [110 + Math.cos(a) * (R - 6) * g, y + Math.sin(a) * (R - 6) * g];
  });
  return (
    ring +
    `M${r1(pts[0][0])} ${r1(pts[0][1])}` +
    [1, 2, 0].map((k) => `Q110 ${y} ${r1(pts[k][0])} ${r1(pts[k][1])}`).join("") +
    [0, 1, 2]
      .map((k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3 + Math.PI / 3;
        return line(110 + Math.cos(a) * (R - 6), y + Math.sin(a) * (R - 6), 110 + Math.cos(a) * (R - 6) * g * 0.6, y + Math.sin(a) * (R - 6) * g * 0.6);
      })
      .join("")
  );
});

export function HeartValve({ p }: MachineProps) {
  const flow = (v: number) => range(v, 0.36, 1);
  // Open while the heart pushes, then shut as the eddies fill the pouches.
  const shut = (v: number) => easeInOut(range(v, 0.74, 0.92));
  const cusps = useTransform(p, (v) => cusp(-1, shut(v)) + cusp(1, shut(v)));
  const blood = useTransform(p, (v) => streaks(flow(v) * 12, 1 - shut(v)));
  const eddies = useTransform(p, (v) => {
    const ph = flow(v) * 14;
    const grow = Math.min(1, range(v, 0.42, 0.6));
    return eddy(CX - 76, 296, 22 * grow, 2.2, ph, 1) + eddy(CX + 76, 296, 22 * grow, 2.2, ph, -1);
  });
  const flowOn = useTransform(p, [0.36, 0.42], [0, 1]);

  return (
    <>
      {/* The valve seen from above, three ways. */}
      <InkSet paths={TOPS} p={p} from={0.04} to={0.22} w={1} />
      <Tone d={circle(110, 120, 38)} p={p} from={0.18} to={0.24} density={15} />

      {/* The root of the aorta in section. */}
      <Tone d={SINUS_SHADE_L} p={p} from={0.2} to={0.28} density={30} />
      <Tone d={mirrorX(SINUS_SHADE_L, CX)} p={p} from={0.2} to={0.28} density={30} />
      <Ink d={WALL_L} p={p} from={0.04} to={0.16} w={1.6} />
      <Ink d={WALL_R} p={p} from={0.06} to={0.18} w={1.6} />
      <Ink d={WALL_HATCH} p={p} from={0.14} to={0.24} w={0.5} opacity={0.7} />
      <LivePath d={cusps} strokeWidth={1.5} />

      {/* Blood out, and the eddies behind the cusps. */}
      <motion.g style={{ opacity: flowOn }} className="spot-layer text-spot">
        <LivePath d={blood} strokeWidth={1.2} opacity={0.8} />
        <LivePath d={eddies} strokeWidth={1.1} />
      </motion.g>

      <Note p={p} from={0.22} x1={CX + 58} y1={120} x2={560} y2={70} text="l’aorta" anchor="end" />
      <Note p={p} from={0.3} x1={CX + 40} y1={330} x2={570} y2={420} text="la valvola" anchor="end" />
      <Note p={p} from={0.5} x1={CX - 84} y1={290} x2={300} y2={472} text="il seno" />
      <Note p={p} from={0.62} x1={CX + 80} y1={296} x2={560} y2={250} text="i vortici" anchor="end" />
      <Note p={p} from={0.2} x1={150} y1={120} x2={230} y2={40} text="chiusa" />
      <Note p={p} from={0.22} x1={150} y1={360} x2={232} y2={404} text="aperta" />

      <Micro p={p} from={0.3} x={190} y={160} size={4.8} lines={["Il sangue che esce", "si rivolge nel seno", "e serra la porta."]} />
    </>
  );
}
