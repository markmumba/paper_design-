"use client";

import type { MachineProps } from "@/components/Exhibit";
import { Ink, Note } from "@/components/ink";
import { line } from "@/lib/geo";
import { TracedSheet, type Traced } from "../TracedSheet";
import data from "../traced/skull.json";

/*
 * Leonardo's skull of 1489, seen from the front with its left half cut
 * away down the middle to show the hollows behind the face, drawn back onto
 * the page stroke by stroke from his sheet (RCIN 919058, verso).
 */

export function Skull({ p }: MachineProps) {
  return (
    <>
      <TracedSheet data={data as Traced} p={p} from={0.03} to={0.4} />
      <g className="spot-layer text-spot">
        {/* The line he drew down the middle, dividing the cut half from the whole. */}
        <Ink d={line(270, 18, 271, 470)} p={p} from={0.48} to={0.6} w={0.9} opacity={0.8} />
      </g>
      <Note p={p} from={0.5} x1={214} y1={236} x2={60} y2={150} text="la metà segata" anchor="end" />
      <Note p={p} from={0.56} x1={330} y1={240} x2={540} y2={170} text="occhio" />
      <Note p={p} from={0.62} x1={300} y1={388} x2={540} y2={420} text="denti" />
      <Note p={p} from={0.68} x1={262} y1={290} x2={64} y2={360} text="le cavità" anchor="end" />
    </>
  );
}
