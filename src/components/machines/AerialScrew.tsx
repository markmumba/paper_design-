"use client";

import { motion, useTransform } from "motion/react";
import { stepped, useCues } from "@/components/cues";
import { sound } from "@/lib/sound";
import { Dim, Fibers, Ink, InkSet, LivePath, Micro, Note, TG, Tone } from "@/components/ink";
import type { MachineProps } from "@/components/Exhibit";
import { circle, easeInOut, ellipse, halfEllipse, hatch, line, range } from "@/lib/geo";
import { dimension, fibersLine, grainAlong, groundLitter, member, rivets, stipple } from "@/lib/detail";

const CX = 300;
const r2 = (n: number) => Math.round(n * 10) / 10;

/** Point on the linen helix at height parameter t (0 bottom .. 1 top), inset from the rim by `inset`. */
function helixPoint(t: number, phase: number, inset = 0) {
  const angle = phase + t * Math.PI * 2.6;
  const r = 138 - 76 * t - inset;
  const y = 336 - 204 * t;
  return { x: CX + Math.cos(angle) * r, y: y + Math.sin(angle) * r * 0.24, y0: y, r, angle, front: Math.sin(angle) > 0 };
}

type Strokes = { near: string; far: string; fineNear: string; fineFar: string };

/**
 * The linen helix, split into near (heavy) and far (light) strokes for depth:
 * rim, sewn hem, ribs, and fine radial threads of the starched cloth.
 */
function helix(phase: number, reveal: number): Strokes {
  const out: Strokes = { near: "", far: "", fineNear: "", fineFar: "" };
  const trace = (inset: number, key: "near" | "fineNear") => {
    const farKey = key === "near" ? "far" : "fineFar";
    let last: boolean | null = null;
    const steps = 140;
    for (let i = 0; i <= steps; i++) {
      const pt = helixPoint((i / steps) * reveal, phase, inset);
      const cmd = last === pt.front ? "L" : "M";
      const seg = `${cmd}${r2(pt.x)} ${r2(pt.y)}`;
      if (pt.front) out[key] += seg;
      else out[farKey] += seg;
      if (last !== null && last !== pt.front) {
        const join = `L${r2(pt.x)} ${r2(pt.y)}`;
        if (pt.front) out[farKey] += join;
        else out[key] += join;
      }
      last = pt.front;
    }
  };
  trace(0, "near");
  trace(5, "fineNear");

  for (let k = 0; k <= 160; k++) {
    const t = k / 160;
    if (t > reveal) break;
    const rim = helixPoint(t, phase);
    if (k % 6 === 0) {
      // Structural cane rib from the mast to the rim.
      const rib = `M${CX} ${r2(rim.y0)}L${r2(rim.x)} ${r2(rim.y)}`;
      if (rim.front) out.near += rib;
      else out.far += rib;
    } else {
      // Fine thread of the cloth, running in from the rim.
      const inner = helixPoint(t, phase, rim.r * 0.55);
      const thread = `M${r2(inner.x)} ${r2(inner.y)}L${r2(rim.x)} ${r2(rim.y)}`;
      if (rim.front) out.fineNear += thread;
      else out.fineFar += thread;
    }
    // Stitches along the hem.
    if (k % 2 === 0) {
      const a = helixPoint(t, phase, 3);
      const b = helixPoint(t, phase, 7);
      const st = `M${r2(a.x)} ${r2(a.y)}L${r2(b.x + 1.2)} ${r2(b.y)}`;
      if (rim.front) out.fineNear += st;
      else out.fineFar += st;
    }
  }
  for (const k of Object.keys(out) as (keyof Strokes)[]) out[k] ||= "M0 0";
  return out;
}

// ── Static parts ───────────────────────────────────────────────────────────
const plankChords = Array.from({ length: 20 }, (_, i) => {
  const x = 166 + i * 14;
  const h = 30 * Math.sqrt(Math.max(0, 1 - ((x - CX) / 150) ** 2));
  return line(x, 400 - h + 0.8, x, 400 + h - 0.8);
}).join("");
const plankNails = Array.from({ length: 20 }, (_, i) => {
  const x = 173 + i * 14;
  const h = 30 * Math.sqrt(Math.max(0, 1 - ((x - CX) / 150) ** 2));
  return `M${x} ${r2(400 - h + 4)}h0.01M${x} ${r2(400 + h - 4)}h0.01`;
}).join("");
const bandPlanks = Array.from({ length: 30 }, (_, i) => {
  const x = 155 + i * 10;
  const y = 400 + 30 * Math.sqrt(Math.max(0, 1 - ((x - CX) / 150) ** 2));
  return line(x, y, x, y + 14);
}).join("");
const bandGrain = [404, 408, 412].map((y, i) => grainAlong(160, y + 20, 440, y + 20, 3, 1, 40 + i, 0)).join("");
const bearing = ellipse(CX, 400, 14, 4) + ellipse(CX, 400, 9, 2.6) + rivets(CX - 11, 400, CX + 11, 400, 4, 0.9);

const mast = member(CX, 404, CX, 118, 8) + grainAlong(CX, 400, CX, 122, 8, 3, 31, 2);
const mastBands = [146, 200, 260, 320, 376].map((y) => ellipse(CX, y, 5, 1.6) + ellipse(CX, y + 4, 5, 1.6)).join("");
const mastRivets = [148, 202, 262, 322, 378].map((y) => rivets(CX - 2, y, CX + 2, y, 2, 0.7)).join("");
const cap = "M291 118L300 98L309 118M296 108h8M300 98v-10M300 88l8 3-8 3";
const mastShade = Array.from({ length: 40 }, (_, i) => line(CX + 1.5, 126 + i * 7, CX + 3.5, 130 + i * 7)).join("");

// Hairline fibres: up the mast, across each deck plank and down the rim boards.
const makeFibers = () =>
  fibersLine(CX, 402, CX, 120, 7.2, 6, 301) +
  Array.from({ length: 19 }, (_, i) => {
    const x = 173 + i * 14;
    const h = 30 * Math.sqrt(Math.max(0, 1 - ((x - CX) / 150) ** 2));
    return h > 4 ? fibersLine(x, 400 - h + 1.5, x, 400 + h - 1.5, 12.5, 12.5, 310 + i, 0.8) : "";
  }).join("") +
  Array.from({ length: 29 }, (_, i) => {
    const x = 160 + i * 10;
    const y = 400 + 30 * Math.sqrt(Math.max(0, 1 - ((x - CX) / 150) ** 2));
    return fibersLine(x, y + 0.8, x, y + 13.4, 9, 9, 340 + i, 0.8);
  }).join("");

const height = dimension(CX + 200, 118, CX + 200, 404, 0);
const radius = dimension(CX, 336, CX + 138, 336, 22);

export function AerialScrew({ p }: MachineProps) {
  const phase = (v: number) => Math.pow(range(v, 0.36, 1), 1.5) * Math.PI * 16;
  const reveal = (v: number) => range(v, 0.1, 0.3);

  // The linen sweeps the air twice a turn: a whoosh for each half-turn of the
  // screw's own angle, louder the faster it is being spun.
  useCues(p, (v, was, speed) => {
    if (!stepped(phase(was), phase(v), Math.PI)) return;
    const turning = (Math.abs(phase(v) - phase(was)) / Math.max(1e-6, Math.abs(v - was))) * speed; // radians per second
    sound.flap(Math.min(1, turning / 14));
  });

  // Compute the helix once per frame and fan it out to four paths.
  const strokes = useTransform(p, (v) => helix(phase(v), reveal(v)));
  const near = useTransform(strokes, (s) => s.near);
  const far = useTransform(strokes, (s) => s.far);
  const fineNear = useTransform(strokes, (s) => s.fineNear);
  const fineFar = useTransform(strokes, (s) => s.fineFar);
  const helixOpacity = useTransform(p, [0.1, 0.12], [0, 1]);

  // Bars pushed round by the crew, turning the platform beneath the mast.
  const bars = useTransform(p, (v) => {
    const a = -phase(v) * 0.5;
    let d = "";
    for (let k = 0; k < 2; k++) {
      const th = a + (k * Math.PI) / 2;
      const dx = Math.cos(th) * 142;
      const dy = Math.sin(th) * 28;
      d += line(CX - dx, 392 - dy, CX + dx, 392 + dy);
      d += line(CX - dx, 395 - dy, CX + dx, 395 + dy);
      d += circle(CX - dx, 392 - dy, 5) + circle(CX + dx, 392 + dy, 5);
      d += circle(CX - dx, 392 - dy, 2) + circle(CX + dx, 392 + dy, 2);
    }
    return d;
  });
  const barsDraw = useTransform(p, [0.2, 0.3], [0, 1]);

  const rise = useTransform(p, (v) => `translate(0 ${easeInOut(range(v, 0.7, 1)) * -58})`);

  return (
    <>
      <Ink d={line(70, 452, 530, 452)} p={p} from={0.02} to={0.1} w={0.6} opacity={0.4} />
      <Ink d={hatch(160, 446, 18, 16, 10, 6)} p={p} from={0.08} to={0.16} w={0.5} opacity={0.3} />
      <Ink d={groundLitter(70, 530, 452, 14, 70)} p={p} from={0.1} to={0.18} w={0.4} opacity={0.6} />
      <Ink d={stipple(CX, 452, 160, 8, 260, 8)} p={p} from={0.14} to={0.2} w={0.6} opacity={0.4} />

      <Micro
        by="leonardo"
        cite="Manuscript B, f. 83v"
        p={p}
        from={0.3}
        x={20}
        y={40}
        size={6}
        lines={[
          "Trovo, se questo strumento a vite",
          "sarà ben fatto, cioè fatto di tela lina",
          "stopata i suoi pori con amido,",
          "e girato con prestezza, che detta vite",
          "si fa la femmina nell’aria",
          "e monterà in alto.",
        ]}
      />

      <TG t={rise}>
        <Tone d={ellipse(CX, 400, 150, 30)} p={p} from={0.2} to={0.3} density={15} />
        <Tone d="M150 400A150 30 0 0 0 450 400L450 414A150 30 0 0 1 150 414Z" p={p} from={0.22} to={0.32} color="spot" density={50} />
        <Tone d={`M${CX - 4} 404H${CX + 4}V118H${CX - 4}Z`} p={p} from={0.24} to={0.3} color="spot" density={70} />
        <InkSet
          p={p}
          from={0.02}
          to={0.14}
          w={1.6}
          paths={[ellipse(CX, 400, 150, 30), halfEllipse(CX, 414, 150, 30), line(150, 400, 150, 414), line(450, 400, 450, 414)]}
        />
        <Ink d={plankChords} p={p} from={0.1} to={0.2} w={0.35} />
        <Ink d={plankNails} p={p} from={0.18} to={0.22} w={0.9} />
        <Ink d={bandPlanks + bandGrain} p={p} from={0.12} to={0.22} w={0.3} />
        <Ink d={hatch(190, 424, 13, 18, 4, 14)} p={p} from={0.12} to={0.2} w={0.5} opacity={0.6} />
        <Ink d={bearing} p={p} from={0.16} to={0.2} w={0.6} />

        <InkSet p={p} from={0.06} to={0.16} w={2.2} paths={[line(CX, 404, CX, 118), ellipse(CX, 118, 9, 3)]} />
        <Ink d={mast} p={p} from={0.12} to={0.22} w={0.35} />
        <Ink d={mastBands + cap} p={p} from={0.16} to={0.24} w={0.6} />
        <Ink d={mastRivets + mastShade} p={p} from={0.2} to={0.26} w={0.45} />
        <Fibers make={makeFibers} p={p} />

        <motion.g style={{ opacity: helixOpacity }}>
          <LivePath d={fineFar} strokeWidth={0.25} opacity={0.3} />
          <LivePath d={far} strokeWidth={0.8} opacity={0.45} />
          <LivePath d={fineNear} strokeWidth={0.3} opacity={0.85} />
          <LivePath d={near} strokeWidth={1.7} />
        </motion.g>
        <LivePath d={bars} draw={barsDraw} strokeWidth={1} />

        <Dim p={p} from={0.26} {...height} label="altezza dell’albero" until={0.36} />
        <Dim p={p} from={0.28} {...radius} label="raggio · braccia otto" until={0.36} />
        <Micro p={p} from={0.32} x={160} y={436} size={3.6} lines={["tavole d’abete inchiodate"]} mirror={false} />

        <Note p={p} from={0.24} x1={420} y1={322} x2={500} y2={268} text="vite" />
        <Note p={p} from={0.27} x1={338} y1={222} x2={430} y2={150} text="lino inamidato" />
        <Note p={p} from={0.3} x1={300} y1={150} x2={196} y2={112} text="albero" anchor="end" />
        <Note p={p} from={0.32} x1={180} y1={420} x2={60} y2={468} text="i garzoni spingono" />
      </TG>
    </>
  );
}
