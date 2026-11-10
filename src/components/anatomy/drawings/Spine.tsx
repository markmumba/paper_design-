"use client";

import type { MachineProps } from "@/components/Exhibit";
import { Ink, Note } from "@/components/ink";
import { TracedSheet, type Traced } from "../TracedSheet";
import data from "../traced/spine.json";

/*
 * Leonardo's vertebral column (c. 1510–11), from the side and from the front,
 * drawn back onto the page stroke by stroke from his sheet (RCIN 919007).
 * His own letters on the sheet mark where neck, back, loins and sacrum
 * meet; our brackets follow them.
 */

// Region boundaries along the side view, at his letters a, b, c, d.
const X = 236;
const BOUNDS = [12, 88, 268, 356, 440];
const bracket = (y0: number, y1: number) => `M${X} ${y0 + 2}h6V${y1 - 2}h-6`;

export function Spine({ p }: MachineProps) {
  const labels = ["sette del collo", "dodici del dorso", "cinque dei lombi", "l’osso sacro"];
  return (
    <>
      <TracedSheet data={data as Traced} p={p} from={0.03} to={0.4} />
      <g className="spot-layer text-spot">
        {labels.map((_, i) => (
          <Ink key={i} d={bracket(BOUNDS[i], BOUNDS[i + 1])} p={p} from={0.46 + i * 0.05} to={0.52 + i * 0.05} w={1.1} />
        ))}
      </g>
      {labels.map((t, i) => (
        <Note key={t} p={p} from={0.48 + i * 0.05} x1={X + 7} y1={(BOUNDS[i] + BOUNDS[i + 1]) / 2} x2={252} y2={40 + i * 112} text={t} />
      ))}
      <Note p={p} from={0.72} x1={152} y1={118} x2={16} y2={210} text="una spina di troppo" anchor="start" />
    </>
  );
}
