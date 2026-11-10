"use client";

import { useTransform } from "motion/react";
import type { MachineProps } from "@/components/Exhibit";
import { LivePath, Note } from "@/components/ink";
import { range } from "@/lib/geo";
import { TracedSheet, type Traced } from "../TracedSheet";
import data from "../traced/heart.json";

/*
 * Leonardo's studies of the aortic valve (c. 1512–13), drawn back onto the
 * page stroke by stroke from his sheet (RCIN 919082): on the left, the valve
 * seen from above and the side; on the right, the root of the aorta with the
 * curling eddies he drew in the pouches behind the cusps. Once his lines are
 * down, those eddies start to turn.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A spiral eddy of `turns` turns, rotated by `phase`. */
function eddy(cx: number, cy: number, r: number, turns: number, phase: number, dir: 1 | -1) {
  let d = "";
  const n = 54;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = dir * (phase + t * turns * Math.PI * 2);
    const rr = r * (1 - t * 0.85);
    d += `${i ? "L" : "M"}${r1(cx + Math.cos(a) * rr)} ${r1(cy + Math.sin(a) * rr)}`;
  }
  return d;
}

// His spirals, as placed on the sheet in this frame.
const EDDIES: [number, number, number, 1 | -1][] = [
  [340, 185, 15, 1],
  [385, 185, 15, -1],
  [421, 352, 11, 1],
  [456, 352, 11, -1],
];

export function HeartValve({ p }: MachineProps) {
  const swirl = useTransform(p, (v) => {
    const on = range(v, 0.44, 0.56);
    if (on <= 0) return "M0 0";
    const ph = range(v, 0.44, 1) * 16;
    return EDDIES.map(([x, y, r, dir]) => eddy(x, y, r * (0.6 + 0.4 * on), 2.2, ph, dir)).join("");
  });
  return (
    <>
      <TracedSheet data={data as Traced} p={p} from={0.03} to={0.4} />
      <g className="spot-layer text-spot">
        <LivePath d={swirl} strokeWidth={1.3} opacity={0.85} />
      </g>
      <Note p={p} from={0.46} x1={128} y1={300} x2={18} y2={360} text="la valvola" />
      <Note p={p} from={0.52} x1={392} y1={182} x2={560} y2={110} text="i vortici" anchor="end" />
      <Note p={p} from={0.6} x1={360} y1={240} x2={560} y2={300} text="il seno" anchor="end" />
      <Note p={p} from={0.66} x1={350} y1={60} x2={240} y2={20} text="l’aorta" anchor="end" />
    </>
  );
}
