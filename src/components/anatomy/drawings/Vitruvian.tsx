"use client";

import type { MachineProps } from "@/components/Exhibit";
import { Dim, Ink, InkSet, Micro, Note, Tone } from "@/components/ink";
import { bisect, limb, mirrorX, type Pt } from "@/lib/body";
import { circle, line } from "@/lib/geo";
import { dimension, stipple } from "@/lib/detail";

/*
 * Our redrawing of the Vitruvian Man, at the proportions Leonardo used: the
 * square is the man's height, its centre is his groin; the circle's centre
 * is his navel. He is drawn first standing with arms level, then his second
 * pose, arms raised and legs apart, over the first, as on the sheet.
 */

const CX = 300;
const CROWN = 95;
const H = 360; // height, crown to soles = side of the square
const SOLE = CROWN + H;
const NAVEL: Pt = [CX, CROWN + 0.394 * H];
const R = 0.618 * H; // the circle, as measured on Leonardo's sheet
const GROIN: Pt = [CX, CROWN + H / 2];
const r1 = (n: number) => Math.round(n * 10) / 10;

// ── Limbs ─────────────────────────────────────────────────────────────────────
const SHOULDER_Y = 160;
const ARM = 138; // shoulder pivot to fingertip
const ARM_PROFILE: Pt[] = [
  [0, 24],
  [0.12, 21],
  [0.27, 18],
  [0.4, 12.5],
  [0.5, 15.5],
  [0.66, 10],
  [0.76, 8],
  [0.84, 11],
  [0.94, 8],
  [1, 2.5],
];
const LEG = 178; // hip pivot to ankle
const LEG_PROFILE: Pt[] = [
  [0, 40],
  [0.18, 35],
  [0.44, 24],
  [0.52, 18],
  [0.62, 22.5],
  [0.74, 19],
  [0.92, 11],
  [1, 10.5],
];

function arm(side: 1 | -1, raise: number) {
  // Shoulder, elbow, wrist and fingertip, the elbow a touch soft.
  const P: Pt = [CX + side * 40, SHOULDER_Y];
  const dir: Pt = [side * Math.cos(raise), -Math.sin(raise)];
  const at = (k: number, sag = 0): Pt => [P[0] + dir[0] * ARM * k, P[1] + dir[1] * ARM * k + sag];
  return limb([P, at(0.41, 1.5), at(0.76, 0.5), at(1)], ARM_PROFILE, -side);
}

function leg(side: 1 | -1, spread: number) {
  const P: Pt = [CX + side * 17, CROWN + 0.48 * H];
  const dir: Pt = [side * Math.sin(spread), Math.cos(spread)];
  const at = (k: number, bow = 0): Pt => [P[0] + dir[0] * LEG * k + side * bow, P[1] + dir[1] * LEG * k];
  const ankle = at(1);
  const shape = limb([P, at(0.52, -1.5), ankle], LEG_PROFILE, side);
  // A foot seen from the front: instep, toes and sole.
  const [ax, ay] = ankle;
  const s = side;
  const foot = `M${r1(ax - s * 5)} ${r1(ay)}Q${r1(ax - s * 7)} ${r1(ay + 7)} ${r1(ax - s * 6)} ${r1(ay + 10)}L${r1(ax + s * 14)} ${r1(ay + 10)}Q${r1(ax + s * 13)} ${r1(ay + 4)} ${r1(ax + s * 5)} ${r1(ay - 1)}`;
  const toes = [0, 1, 2, 3].map((k) => `M${r1(ax + s * (-3 + k * 4))} ${r1(ay + 7.5)}v2.5`).join("");
  return { contour: shape.contour + foot, hatch: shape.hatch + toes, sole: [ax + s * 4, ay + 10] as Pt };
}

// Solve the second pose so fingertips and soles land on the circle.
const RAISE = bisect((a) => {
  const P: Pt = [CX + 40, SHOULDER_Y];
  const F: Pt = [P[0] + Math.cos(a) * ARM, P[1] - Math.sin(a) * ARM];
  return Math.hypot(F[0] - NAVEL[0], F[1] - NAVEL[1]) - R;
}, 0.05, 1.3);
// The legs part as on his sheet: the feet land a little inside the circle,
// about 0.31 of the height either side and 0.9 of it below the crown.
const SPREAD = 0.55;

const T_ARMS = [arm(-1, 0.015), arm(1, 0.015)];
const X_ARMS = [arm(-1, RAISE), arm(1, RAISE)];
const T_LEGS = [leg(-1, 0.012), leg(1, 0.012)];
const X_LEGS = [leg(-1, SPREAD), leg(1, SPREAD)];

// ── Torso and head ────────────────────────────────────────────────────────────
// The left half, mirrored for the right.
const HALF =
  `M${CX - 9} 141Q${CX - 10} 149 ${CX - 14} 153Q${CX - 28} 156 ${CX - 40} 160` + // neck and trapezius
  `M${CX - 37} 177Q${CX - 37} 196 ${CX - 33} 210Q${CX - 27} 224 ${CX - 28} 236Q${CX - 31} 248 ${CX - 34} 258`; // flank, waist, hip
const DETAIL_HALF =
  `M${CX - 5} 154Q${CX - 20} 152 ${CX - 34} 158` + // collarbone
  `M${CX - 2} 179Q${CX - 16} 192 ${CX - 32} 184` + // pectoral
  `M${CX - 3} 201Q${CX - 15} 203 ${CX - 26} 214` + // ribcage arch
  `M${CX - 10} 213Q${CX - 12} 222 ${CX - 11} 230M${CX - 11} 230Q${CX - 13} 242 ${CX - 12} 250` + // edge of the belly
  `M${CX - 30} 252Q${CX - 18} 262 ${CX - 6} 274` + // groin crease
  `M${CX - 30} 170Q${CX - 26} 178 ${CX - 28} 186`; // under the shoulder
const TORSO = HALF + mirrorX(HALF, CX);
const TORSO_DETAIL =
  DETAIL_HALF +
  mirrorX(DETAIL_HALF, CX) +
  `M${CX} 199V250` + // the white line down the belly
  [213, 224].map((y) => `M${CX - 9} ${y}Q${CX} ${y + 2} ${CX + 9} ${y}`).join("") +
  circle(NAVEL[0], NAVEL[1], 1.6) +
  `M${CX - 22} 186h0.1M${CX + 22} 186h0.1`;
const TORSO_SHADE = `M${CX + 14} 155Q${CX + 40} 160 ${CX + 37} 177Q${CX + 37} 196 ${CX + 33} 210Q${CX + 27} 224 ${CX + 28} 236Q${CX + 31} 248 ${CX + 34} 258L${CX + 6} 274Q${CX + 12} 230 ${CX + 4} 199Z`;

const HEAD =
  `M${CX} ${CROWN + 1}C${CX + 17} ${CROWN + 1} ${CX + 17} ${CROWN + 30} ${CX + 13} ${CROWN + 36}Q${CX + 8} ${CROWN + 45} ${CX} ${CROWN + 45}` +
  `Q${CX - 8} ${CROWN + 45} ${CX - 13} ${CROWN + 36}C${CX - 17} ${CROWN + 30} ${CX - 17} ${CROWN + 1} ${CX} ${CROWN + 1}`;
const FACE =
  `M${CX - 9} ${CROWN + 20}q4 -2 7 0M${CX + 2} ${CROWN + 20}q4 -2 7 0` + // brows
  `M${CX - 8} ${CROWN + 23.5}q3 -1.4 5.5 0M${CX + 2.5} ${CROWN + 23.5}q3 -1.4 5.5 0` + // eyes
  `M${CX} ${CROWN + 22}l-1.6 9.5q1.6 1.3 3.4 0` + // nose
  `M${CX - 5} ${CROWN + 36}q5 1.6 10 0` + // mouth
  `M${CX - 16} ${CROWN + 22}q-3 4 0 9M${CX + 16} ${CROWN + 22}q3 4 0 9`; // ears
// Leonardo's man has a full head of curls: small loops round the crown.
const CURLS = Array.from({ length: 22 }, (_, i) => {
  const a = Math.PI * (0.95 + (i / 21) * 1.1);
  const rx = 19 + (i % 3) * 1.5;
  const x = CX + Math.cos(a) * rx;
  const y = CROWN + 22 + Math.sin(a) * 25;
  const s = 2.6 + (i % 2);
  return `M${r1(x)} ${r1(y)}c${r1(s)} ${r1(-s)} ${r1(s * 2)} ${r1(s * 0.4)} ${r1(s * 0.6)} ${r1(s * 1.6)}`;
}).join("");

// ── The frame: square, circle and the scale of palms below ───────────────────
const SQUARE = [line(CX - H / 2, CROWN, CX + H / 2, CROWN), line(CX + H / 2, CROWN, CX + H / 2, SOLE), line(CX + H / 2, SOLE, CX - H / 2, SOLE), line(CX - H / 2, SOLE, CX - H / 2, CROWN)];
const PALM = H / 24; // Vitruvius: a palm is four fingers, a man is 24 palms
const SCALE =
  line(CX - H / 2, SOLE + 14, CX + H / 2, SOLE + 14) +
  Array.from({ length: 25 }, (_, i) => `M${r1(CX - H / 2 + i * PALM)} ${SOLE + 11}v6`).join("") +
  Array.from({ length: 4 }, (_, i) => `M${r1(CX - H / 2 + (i * PALM) / 4)} ${SOLE + 12}v4M${r1(CX + H / 2 - (i * PALM) / 4)} ${SOLE + 12}v4`).join("");

const SPAN = dimension(CX - H / 2, CROWN, CX + H / 2, CROWN, -14);
const HEIGHT = dimension(CX + H / 2, CROWN, CX + H / 2, SOLE, -18);
const HEAD_DIM = dimension(CX - H / 2, CROWN, CX - H / 2, CROWN + H / 8, 18);

export function Vitruvian({ p }: MachineProps) {
  return (
    <>
      {/* The frame is ruled first, as he did, then the man is drawn into it. */}
      <Ink d={circle(NAVEL[0], NAVEL[1], R)} p={p} from={0.02} to={0.12} w={1.1} />
      <InkSet paths={SQUARE} p={p} from={0.04} to={0.12} w={1.1} />
      <Ink d={SCALE} p={p} from={0.1} to={0.16} w={0.7} opacity={0.8} />

      {/* First pose: arms level, feet together. */}
      <Tone d={TORSO_SHADE} p={p} from={0.2} to={0.28} density={15} />
      <Ink d={HEAD} p={p} from={0.1} to={0.16} w={1.3} />
      <Ink d={CURLS} p={p} from={0.14} to={0.22} w={0.8} />
      <Ink d={FACE} p={p} from={0.16} to={0.22} w={0.8} />
      <Ink d={TORSO} p={p} from={0.12} to={0.2} w={1.4} />
      <Ink d={TORSO_DETAIL} p={p} from={0.18} to={0.26} w={0.7} />
      {T_ARMS.map((a, i) => (
        <g key={`ta${i}`}>
          <Ink d={a.contour} p={p} from={0.14} to={0.24} w={1.3} />
          <Ink d={a.hatch} p={p} from={0.22} to={0.3} w={0.45} opacity={0.75} />
        </g>
      ))}
      {T_LEGS.map((l, i) => (
        <g key={`tl${i}`}>
          <Ink d={l.contour} p={p} from={0.16} to={0.26} w={1.3} />
          <Ink d={l.hatch} p={p} from={0.24} to={0.32} w={0.45} opacity={0.75} />
        </g>
      ))}

      {/* Second pose, drawn over the first: arms raised, legs apart. */}
      {X_ARMS.map((a, i) => (
        <g key={`xa${i}`}>
          <Ink d={a.contour} p={p} from={0.4} to={0.52} w={1.1} />
          <Ink d={a.hatch} p={p} from={0.5} to={0.58} w={0.4} opacity={0.6} />
        </g>
      ))}
      {X_LEGS.map((l, i) => (
        <g key={`xl${i}`}>
          <Ink d={l.contour} p={p} from={0.44} to={0.56} w={1.1} />
          <Ink d={l.hatch} p={p} from={0.52} to={0.6} w={0.4} opacity={0.6} />
        </g>
      ))}

      {/* The two centres, in the spot colour. */}
      <g className="spot-layer text-spot">
        <Ink d={line(NAVEL[0] - 9, NAVEL[1], NAVEL[0] + 9, NAVEL[1]) + line(NAVEL[0], NAVEL[1] - 9, NAVEL[0], NAVEL[1] + 9)} p={p} from={0.6} to={0.64} w={1.3} />
        <Ink d={line(CX - H / 2, CROWN, CX + H / 2, SOLE) + line(CX + H / 2, CROWN, CX - H / 2, SOLE)} p={p} from={0.72} to={0.84} w={0.6} opacity={0.7} />
        <Ink d={stipple(GROIN[0], GROIN[1], 3, 3, 14, 7)} p={p} from={0.8} to={0.84} w={1.4} />
      </g>

      <Dim p={p} from={0.62} {...SPAN} label="le braccia aperte" />
      <Dim p={p} from={0.66} {...HEIGHT} label="l’altezza" />
      <Dim p={p} from={0.7} {...HEAD_DIM} label="un ottavo" />

      <Note p={p} from={0.6} x1={NAVEL[0] + 4} y1={NAVEL[1]} x2={NAVEL[0] + 120} y2={NAVEL[1] + 52} text="l’ombelico" />
      <Note p={p} from={0.3} x1={CX + R * 0.72} y1={NAVEL[1] - R * 0.69} x2={560} y2={44} text="il cerchio" anchor="end" />
      <Note p={p} from={0.84} x1={GROIN[0] - 4} y1={GROIN[1] + 2} x2={40} y2={420} text="il centro del quadrato" />

      <Micro
        p={p}
        from={0.3}
        x={22}
        y={24}
        size={5.2}
        lines={["Le misure dell’uomo", "son dalla natura distribuite:", "quattro diti fanno un palmo,", "e ventiquattro palmi fanno un uomo."]}
      />
    </>
  );
}
