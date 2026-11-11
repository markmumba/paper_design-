"use client";

import type { MachineProps } from "@/components/Exhibit";
import { Ink, Note } from "@/components/ink";
import { circle } from "@/lib/geo";
import { TracedSheet, type Traced } from "../TracedSheet";
import data from "../traced/shoulder.json";

/*
 * Leonardo's muscles of the shoulder, arm and neck (c. 1510–11), drawn back
 * onto the page stroke by stroke from his sheet (RCIN 919008, verso): the
 * same shoulder four times, turning from the front towards the back, and in
 * the corner the star of eight points with which he planned the views.
 */

// Where his four views stand, left to right, and his star (in this frame).
const TOPS: [number, number][] = [
  [118, 70],
  [212, 68],
  [318, 72],
  [482, 92],
];
const STAR: [number, number] = [465, 420];

export function Shoulder({ p }: MachineProps) {
  // A red arc over the four views: the turn he made between them.
  const arc = `M${TOPS[0][0]} ${TOPS[0][1] - 26}Q300 -20 ${TOPS[3][0]} ${TOPS[3][1] - 30}`;
  const head = `M${TOPS[3][0] - 10} ${TOPS[3][1] - 42}L${TOPS[3][0]} ${TOPS[3][1] - 30}L${TOPS[3][0] - 13} ${TOPS[3][1] - 26}`;
  // His eight viewpoints, picked out on the star.
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    return circle(STAR[0] + Math.cos(a) * 38, STAR[1] + Math.sin(a) * 38, 2.2);
  }).join("");
  return (
    <>
      <TracedSheet data={data as Traced} p={p} from={0.03} to={0.4} />
      <g className="spot-layer text-spot">
        <Ink d={arc + head} p={p} from={0.46} to={0.58} w={1.2} />
        {TOPS.map(([x, y], i) => (
          <Ink key={i} d={circle(x, y - 26, 7)} p={p} from={0.5 + i * 0.03} to={0.53 + i * 0.03} w={1} />
        ))}
        <Ink d={points} p={p} from={0.66} to={0.74} w={2.4} />
      </g>
      <Note p={p} from={0.62} x1={470} y1={170} x2={590} y2={130} text="il deltoide" anchor="end" />
      <Note p={p} from={0.64} x1={102} y1={150} x2={20} y2={220} text="il deltoide diviso" />
      <Note p={p} from={0.68} x1={STAR[0] - 40} y1={STAR[1]} x2={330} y2={466} text="gli otto aspetti" anchor="end" />
    </>
  );
}
