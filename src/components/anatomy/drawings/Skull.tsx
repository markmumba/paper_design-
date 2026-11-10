"use client";

import { useTransform } from "motion/react";
import type { MachineProps } from "@/components/Exhibit";
import { Ink, Micro, Note, TG, Tone } from "@/components/ink";
import { easeInOut, ellipse, line, range } from "@/lib/geo";
import { stipple } from "@/lib/detail";

/*
 * Our redrawing after Leonardo's skull studies of 1489: the skull in profile,
 * its vault sawn off and lifted to show the inside, and set where three lines
 * at right angles meet, front to back, top to bottom and side to side.
 */

// The vault, above the saw cut, with the bone's thickness along its edge.
const VAULT =
  "M172 172C174 130 202 100 246 86C302 70 380 80 404 118Q414 140 413 160" +
  "M184 170C188 136 212 110 250 98C300 84 368 92 392 124Q401 142 401 158";
// The band between the two edges: the thickness of the bone itself.
const VAULT_BONE =
  "M172 172C174 130 202 100 246 86C302 70 380 80 404 118Q414 140 413 160L401 158Q401 142 392 124C368 92 300 84 250 98C212 110 188 136 184 170Z";
const CUT_TOP = ellipse(292, 166, 121, 12);
// Below the cut: brow, face, jaw and the base at the back.
const CRANIUM =
  "M413 160C416 172 418 180 419 188" + // forehead down to the brow
  "M172 172C166 192 164 206 166 222C170 252 186 276 210 292Q236 302 258 300"; // back of the head
const CUT_BELOW = "M172 172Q292 186 413 160";
const FACE =
  "M419 188Q426 196 431 208L436 232Q440 248 434 258" + // nasal bones
  "M434 258Q422 262 414 256" + // nasal opening
  "M434 258Q440 270 438 290L430 302" + // upper jaw
  "M430 302L366 304" + // upper teeth line
  "M372 304Q366 296 350 292Q338 288 326 290" + // back of the upper jaw
  "M396 262Q372 262 352 268Q334 272 320 270" + // cheekbone and arch
  "M258 300Q272 318 288 306Q296 296 306 292"; // mastoid
const JAW =
  "M432 306L436 330Q438 352 418 358Q384 364 346 352Q330 346 324 330L318 296" + // body and ramus
  "M318 296Q312 288 314 280Q322 276 326 284Z" + // condyle
  "M332 300Q340 290 350 296"; // notch
const ORBIT = "M372 196Q392 184 414 194Q420 214 410 234Q392 244 376 234Q366 214 372 196Z";
const TEETH =
  Array.from({ length: 8 }, (_, i) => {
    const x = 428 - i * 8;
    return `M${x} 304v${10 - i * 0.4}h-6.5v${-(10 - i * 0.4)}`;
  }).join("") +
  Array.from({ length: 8 }, (_, i) => {
    const x = 428 - i * 8;
    return `M${x} 316v-9h-6.5v9`;
  }).join("");
const EAR = ellipse(296, 262, 7, 9) + ellipse(296, 262, 3, 4);
// Sutures, the wavy joins between the plates of the skull.
const suture = (pts: [number, number][], amp = 2.4) =>
  pts
    .slice(1)
    .map(([x, y], i) => {
      const [px, py] = pts[i];
      const n = 7;
      let d = i === 0 ? `M${px} ${py}` : "";
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        d += `L${(px + (x - px) * t + (k % 2 ? amp : -amp)).toFixed(1)} ${(py + (y - py) * t).toFixed(1)}`;
      }
      return d;
    })
    .join("");
const SUTURES_VAULT = suture([
  [330, 78],
  [334, 120],
  [340, 168],
]);
const SUTURES_BACK = suture([
  [196, 196],
  [214, 240],
  [244, 276],
]);
const TEMPORAL = "M410 176Q380 150 330 156Q270 166 236 210Q224 236 232 262";

// Shading: the side of the face, the orbit's depth, the back of the skull.
const SHADE_ORBIT = ORBIT;
const SHADE_BACK = "M172 172C166 192 164 206 166 222C170 252 186 276 210 292Q236 302 258 300L250 240Q210 210 196 172Z";
const SHADE_JAW = "M432 306L436 330Q438 352 418 358Q384 364 346 352L360 330Q400 336 420 316Z";

export function Skull({ p }: MachineProps) {
  // The vault lifts away, then the three lines are drawn through the skull.
  const lift = useTransform(p, (v) => `translate(${-6 * easeInOut(range(v, 0.36, 0.62))} ${-38 * easeInOut(range(v, 0.36, 0.62))})`);
  return (
    <>
      <Ink d={line(120, 392, 480, 392)} p={p} from={0.02} to={0.08} w={0.5} opacity={0.35} />
      <Tone d={SHADE_BACK} p={p} from={0.2} to={0.28} density={30} />
      <Tone d={SHADE_ORBIT} p={p} from={0.22} to={0.28} density={30} />
      <Tone d={SHADE_JAW} p={p} from={0.24} to={0.3} density={15} />
      <Ink d={CRANIUM} p={p} from={0.04} to={0.14} w={1.6} />
      <Ink d={FACE} p={p} from={0.08} to={0.18} w={1.3} />
      <Ink d={JAW} p={p} from={0.12} to={0.22} w={1.4} />
      <Ink d={ORBIT} p={p} from={0.12} to={0.18} w={1.2} />
      <Ink d={TEETH} p={p} from={0.18} to={0.26} w={0.6} />
      <Ink d={EAR + TEMPORAL} p={p} from={0.18} to={0.26} w={0.6} opacity={0.8} />
      <Ink d={SUTURES_BACK} p={p} from={0.24} to={0.3} w={0.5} />
      <Ink d={stipple(360, 236, 40, 30, 120, 11)} p={p} from={0.24} to={0.3} w={0.6} opacity={0.5} />

      {/* The saw cut, and the inside it opens onto. */}
      <Ink d={CUT_BELOW} p={p} from={0.34} to={0.4} w={0.9} />
      <Tone d={CUT_TOP} p={p} from={0.48} to={0.56} color="spot" density={30} />
      <Ink d={CUT_TOP + ellipse(292, 166, 110, 8)} p={p} from={0.48} to={0.56} w={0.7} />
      <TG t={lift}>
        <Tone d={VAULT_BONE} p={p} from={0.2} to={0.28} density={50} />
        <Ink d={VAULT} p={p} from={0.04} to={0.16} w={1.6} />
        <Ink d={SUTURES_VAULT} p={p} from={0.22} to={0.3} w={0.5} />
      </TG>

      {/* Three lines at right angles, meeting inside the skull. */}
      <g className="spot-layer text-spot">
        <Ink d={line(110, 210, 490, 210)} p={p} from={0.66} to={0.74} w={0.9} />
        <Ink d={line(300, 40, 300, 380)} p={p} from={0.7} to={0.78} w={0.9} />
        <Ink d={line(240, 262, 360, 158)} p={p} from={0.74} to={0.82} w={0.9} />
        <Ink d={stipple(300, 210, 3, 3, 14, 5)} p={p} from={0.82} to={0.86} w={1.6} />
      </g>

      <Note p={p} from={0.3} x1={392} y1={214} x2={520} y2={150} text="occhio" anchor="start" />
      <Note p={p} from={0.32} x1={400} y1={350} x2={520} y2={400} text="mascella" />
      <Note p={p} from={0.56} x1={250} y1={120} x2={96} y2={70} text="segato" anchor="end" />
      <Note p={p} from={0.84} x1={302} y1={212} x2={150} y2={350} text="le tre linee" anchor="end" />

      <Micro
        p={p}
        from={0.3}
        x={430}
        y={30}
        size={5}
        lines={["Taglia il capo", "e vedi dentro", "dove le tre linee", "s’intersegano."]}
      />
    </>
  );
}
