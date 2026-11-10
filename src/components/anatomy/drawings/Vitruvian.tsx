"use client";

import type { MachineProps } from "@/components/Exhibit";
import { Dim, Ink, Note } from "@/components/ink";
import { circle, line } from "@/lib/geo";
import { dimension, stipple } from "@/lib/detail";
import { TracedSheet, type Traced } from "../TracedSheet";
import data from "../traced/vit.json";

/*
 * Leonardo's own Vitruvian Man, drawn back onto the page stroke by stroke,
 * then measured in the spot colour. The overlay coordinates come from his
 * sheet (circle, square, navel, groin) mapped into this frame.
 */

const S = 0.5601; // sheet pixels (at 960 wide) to this frame
const X = (x: number) => 68 + (x - 65) * S;
const Y = (y: number) => 8 + (y - 134) * S;
const NAVEL = [X(480), Y(548)] as const;
const R = 412 * S;
const SQ = { x0: X(140), y0: Y(285), x1: X(822), y1: Y(952) };
const GROIN = [X(481), Y(618)] as const;
const H = SQ.y1 - SQ.y0;

const SPAN = dimension(SQ.x0, SQ.y0, SQ.x1, SQ.y0, -10);
const HEIGHT = dimension(SQ.x1, SQ.y0, SQ.x1, SQ.y1, -14);
const HEAD = dimension(SQ.x0, SQ.y0, SQ.x0, SQ.y0 + H / 8, 14);

export function Vitruvian({ p }: MachineProps) {
  return (
    <>
      <TracedSheet data={data as Traced} p={p} from={0.03} to={0.4} />

      {/* Measured over his lines: the circle's centre, the square's centre. */}
      <g className="spot-layer text-spot">
        <Ink d={circle(NAVEL[0], NAVEL[1], R)} p={p} from={0.46} to={0.56} w={1} opacity={0.75} />
        <Ink d={line(NAVEL[0] - 10, NAVEL[1], NAVEL[0] + 10, NAVEL[1]) + line(NAVEL[0], NAVEL[1] - 10, NAVEL[0], NAVEL[1] + 10)} p={p} from={0.54} to={0.58} w={1.4} />
        <Ink d={line(NAVEL[0], NAVEL[1], X(172), Y(292)) + line(NAVEL[0], NAVEL[1], X(272), Y(885))} p={p} from={0.56} to={0.64} w={0.8} opacity={0.8} />
        <Ink d={line(SQ.x0, SQ.y0, SQ.x1, SQ.y1) + line(SQ.x1, SQ.y0, SQ.x0, SQ.y1)} p={p} from={0.72} to={0.84} w={0.7} opacity={0.7} />
        <Ink d={stipple(GROIN[0], GROIN[1], 3, 3, 14, 7)} p={p} from={0.82} to={0.86} w={1.6} />
      </g>

      <Dim p={p} from={0.62} {...SPAN} label="le braccia aperte" />
      <Dim p={p} from={0.66} {...HEIGHT} label="l’altezza" />
      <Dim p={p} from={0.7} {...HEAD} label="un ottavo" />

      <Note p={p} from={0.56} x1={NAVEL[0] + 4} y1={NAVEL[1]} x2={NAVEL[0] + 150} y2={NAVEL[1] + 60} text="l’ombelico" />
      <Note p={p} from={0.48} x1={X(840)} y1={Y(240)} x2={572} y2={40} text="il cerchio" anchor="end" />
      <Note p={p} from={0.84} x1={GROIN[0] - 4} y1={GROIN[1] + 2} x2={30} y2={410} text="il centro del quadrato" />
    </>
  );
}
