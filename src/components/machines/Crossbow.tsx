"use client";

import { motion, useTransform } from "motion/react";
import { rose, stepped, useCues } from "@/components/cues";
import { sound } from "@/lib/sound";
import { Dim, Fibers, Ink, InkSet, LivePath, Micro, Note, TG, Tone } from "@/components/ink";
import type { MachineProps } from "@/components/Exhibit";
import { circle, easeIn, easeInOut, gear, hatch, line, poly, range } from "@/lib/geo";
import { dimension, fibers, fibersLine, grainAlong, member, radialTicks, rings, rivets, rope, sampleQuad, stipple } from "@/lib/detail";

const MID = 260;
const f = (n: number) => Math.round(n * 10) / 10;

/** How far the string is drawn: 0 at rest, 1 fully spanned, wobbling after release. */
function tension(v: number) {
  if (v < 0.36) return 0;
  if (v < 0.68) return easeInOut(range(v, 0.36, 0.68));
  if (v < 0.7) return 1;
  const u = range(v, 0.7, 0.95);
  if (u < 0.04) return 1 - u / 0.04;
  const k = u - 0.04;
  return -0.16 * Math.exp(-6 * k) * Math.sin(26 * k);
}

const quad = (t: number, a: number[], c: number[], b: number[]) => [
  (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];

/** The laminated bow: outer and inner faces, inner laminations and cord bindings. */
function bow(s: number) {
  const tipX = 440 - 46 * s;
  const tipY = 50 + 30 * s;
  const botY = MID * 2 - tipY;
  const arm = (cx: number, cyTop: number, midX: number) => {
    return `M${f(tipX)} ${f(tipY)}Q${f(cx)} ${f(cyTop)} ${midX} ${MID}Q${f(cx)} ${f(MID * 2 - cyTop)} ${f(tipX)} ${f(botY)}`;
  };
  const outerC = [514 - 8 * s, 132 + 10 * s];
  const innerC = [496 - 8 * s, 140 + 10 * s];
  const outer = arm(outerC[0], outerC[1], 484);
  const inner = arm(innerC[0], innerC[1], 470);

  let lam = "";
  for (const k of [0.25, 0.5, 0.75]) {
    lam += arm(innerC[0] + (outerC[0] - innerC[0]) * k, innerC[1] + (outerC[1] - innerC[1]) * k, 470 + 14 * k);
  }
  // Cord bindings wrapped round each arm.
  let bind = "";
  for (const t of [0.18, 0.4, 0.62, 0.8]) {
    for (const sign of [1, -1]) {
      for (let w = -2; w <= 2; w++) {
        const tt = t + w * 0.008;
        const [ox, oy] = quad(tt, [tipX, tipY], outerC, [484, MID]);
        const [ix, iy] = quad(tt, [tipX, tipY], innerC, [470, MID]);
        const my = (y: number) => (sign === 1 ? y : MID * 2 - y);
        bind += `M${f(ox + 1)} ${f(my(oy))}L${f(ix - 1)} ${f(my(iy + 1.5))}`;
      }
    }
  }
  // Iron tip caps where the string is tied.
  const caps = `${circle(tipX, tipY, 3)}${circle(tipX, botY, 3)}`;
  return { outer, inner, detail: lam + bind + caps, tipX, tipY, botY };
}

const nockX = (s: number) => 440 - 255 * s;

// Six wheels splayed outward, as in the notebook drawing.
const wheel = (x: number, y: number, ang: number) => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const tr = ([px, py]: number[]): [number, number] => [x + px * c - py * s, y + px * s + py * c];
  const outline = poly([[-17, -5], [17, -5], [17, 5], [-17, 5]].map(tr), true);
  let treads = "";
  for (let i = -15; i <= 15; i += 2.5) {
    const [ax, ay] = tr([i, -5]);
    const [bx, by] = tr([i + 0.6, 5]);
    treads += `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
  }
  const [hx, hy] = tr([0, 0]);
  return { outline, detail: treads + circle(hx, hy, 2.2) + `M${f(hx)} ${f(hy)}h0.01` };
};
const WHEELS = [150, 290, 420].flatMap((x) => [wheel(x, 226, -0.3), wheel(x, 294, 0.3)]);
const wheels = WHEELS.map((w) => w.outline);
const wheelDetail = WHEELS.map((w) => w.detail).join("");
const axles = [150, 290, 420].map((x) => line(x, 226, x, 294));
const axleDetail = [150, 290, 420].map((x) => member(x, 222, x, 298, 4)).join("");

const carriage = [
  `M110 ${MID - 14}H470V${MID + 14}H110Z`,
  "M110 246Q290 228 470 238",
  "M110 274Q290 292 470 282",
  ...[180, 230, 340, 390].map((x) => line(x, MID - 14, x, MID + 14)),
];
const carriageGrain =
  grainAlong(112, MID, 468, MID, 26, 7, 101, 3) +
  [200, 300, 400, 455].map((x) => `M${x - 3} ${MID - 14}V${MID + 14}M${x + 3} ${MID - 14}V${MID + 14}`).join("") +
  [200, 300, 400, 455].map((x) => rivets(x, MID - 10, x, MID + 10, 4, 0.8)).join("") +
  "M180 246L230 274M230 246L180 274M340 246L390 274M390 246L340 274";
// The groove the bolt slides along.
const groove = `M150 ${MID - 3}H470M150 ${MID + 3}H470`;

const bolt =
  "M0 0H150M0 -1.6H150M0 1.6H150M150 -6L170 0L150 6ZM152 -3L164 0L152 3M0 0L-12 -8M0 0L-12 8M10 0L-2 -8M10 0L-2 8" +
  Array.from({ length: 6 }, (_, i) => `M${-10 + i * 2} ${-6 + i * 0.9}l2 -2M${-10 + i * 2} ${6 - i * 0.9}l2 2`).join("");

// Hairline fibres: the long bed (split into its boards), the side rails and the axles.
const makeFibers = () =>
  [MID - 9.5, MID - 0.5, MID + 8.5].map((y, i) => fibersLine(112, y, 468, y, 8.4, 8.4, 700 + i, 0.9)).join("") +
  fibers(sampleQuad([110, 246], [290, 228], [470, 238], 30), 3, 3, 710, 0.6) +
  fibers(sampleQuad([110, 274], [290, 292], [470, 282], 30), 3, 3, 711, 0.6) +
  [150, 290, 420].map((x, i) => fibersLine(x, 223, x, 297, 3.4, 3.4, 720 + i, 0.6)).join("");

const span = dimension(566, 50, 566, 470, 0);
const bed = dimension(110, 318, 470, 318, 0);

export function Crossbow({ p }: MachineProps) {
  useCues(p, (v, was) => {
    // The ratchet clicks once for each of the winch's twelve teeth, as it
    // winds (or, scrolling back, as it is let off again).
    const turned = (x: number) => Math.max(0, x < 0.7 ? tension(x) : 1) * 900;
    if (stepped(turned(was), turned(v), 360 / 12)) sound.tick();
    // The nut lets go: the string is loosed on the frame the bolt leaves.
    if (rose(was, v, 0.7)) sound.twang();
  });
  const shape = useTransform(p, (v) => bow(tension(v)));
  const outer = useTransform(shape, (b) => b.outer);
  const inner = useTransform(shape, (b) => b.inner);
  const bowDetail = useTransform(shape, (b) => b.detail);
  const string = useTransform(p, (v) => {
    const s = tension(v);
    const b = bow(s);
    const n = nockX(s);
    return `M${b.tipX} ${b.tipY}L${n} ${MID}L${b.tipX} ${b.botY}M${b.tipX - 1} ${b.tipY + 1}L${n - 1} ${MID}L${b.tipX - 1} ${b.botY - 1}`;
  });
  const winchRope = useTransform(p, (v) => `M152 ${MID}L${nockX(Math.max(0, tension(v)))} ${MID}`);
  const nut = useTransform(p, (v) => `translate(${nockX(Math.max(0, tension(v)))} ${MID})`);
  const winch = useTransform(p, (v) => `rotate(${Math.max(0, v < 0.7 ? tension(v) : 1) * 900} 130 ${MID})`);
  const boltPos = useTransform(p, (v) => {
    const flight = v < 0.7 ? 0 : easeIn(range(v, 0.7, 0.8)) * 1100;
    const x = Math.max(nockX(Math.max(0, tension(v))), nockX(1) + flight);
    return `translate(${v < 0.7 ? nockX(tension(v)) : x} ${MID})`;
  });
  const boltOpacity = useTransform(p, [0.3, 0.34, 0.78, 0.8], [0, 1, 1, 0]);
  const bowDraw = useTransform(p, [0.08, 0.22], [0, 1]);
  const detailDraw = useTransform(p, [0.2, 0.3], [0, 1]);
  const stringDraw = useTransform(p, [0.2, 0.28], [0, 1]);
  const ropeOpacity = useTransform(p, [0.34, 0.38], [0, 1]);
  const streak = useTransform(p, [0.7, 0.72, 0.8], [0, 0.8, 0]);

  return (
    <>
      <Ink d={stipple(290, 260, 200, 50, 320, 61)} p={p} from={0.16} to={0.22} w={0.6} opacity={0.35} />
      <InkSet paths={axles} p={p} from={0.02} to={0.08} w={1.2} />
      <Ink d={axleDetail} p={p} from={0.08} to={0.14} w={0.35} />
      <Tone d={wheels.join("")} p={p} from={0.2} to={0.3} color="spot" density={70} />
      <Tone d={`M110 ${MID - 14}H470V${MID + 14}H110Z`} p={p} from={0.22} to={0.3} density={15} />
      <InkSet paths={wheels} p={p} from={0.04} to={0.14} w={1.4} />
      <Ink d={wheelDetail} p={p} from={0.12} to={0.2} w={0.35} />
      <InkSet paths={carriage} p={p} from={0.02} to={0.16} w={1.5} />
      <Ink d={carriageGrain} p={p} from={0.12} to={0.24} w={0.3} />
      <Fibers make={makeFibers} p={p} />
      <Ink d={groove} p={p} from={0.16} to={0.22} w={0.5} />
      <Ink d={hatch(120, 266, 20, 17, 8, 7)} p={p} from={0.14} to={0.2} w={0.5} opacity={0.5} />

      <LivePath d={outer} draw={bowDraw} strokeWidth={2.2} />
      <LivePath d={inner} draw={bowDraw} strokeWidth={1.2} />
      <LivePath d={bowDetail} draw={detailDraw} strokeWidth={0.35} />
      <LivePath d={string} draw={stringDraw} strokeWidth={0.6} className="text-sepia" />
      <motion.g style={{ opacity: ropeOpacity }} className="text-sepia">
        <LivePath d={winchRope} strokeWidth={1} strokeDasharray="4 3" />
      </motion.g>

      <TG t={winch}>
        <Tone d={circle(130, MID, 22)} p={p} from={0.22} to={0.3} color="spot" density={50} />
        <Ink d={gear(130, MID, 24, 12)} p={p} from={0.16} to={0.22} w={1.3} />
        <Ink d={rings(130, MID, [18, 14, 5, 2.5]) + radialTicks(130, MID, 5, 14, 6)} p={p} from={0.2} to={0.26} w={0.4} />
        <Ink d={line(130, MID, 130, MID - 40) + line(127, MID, 127, MID - 40) + circle(130, MID - 44, 4) + circle(130, MID - 44, 1.6)} p={p} from={0.2} to={0.24} w={1} />
      </TG>
      {/* Ratchet pawl that holds the winch. */}
      <Ink d="M150 232L138 238L141 240L152 235ZM150 232h0.01" p={p} from={0.24} to={0.28} w={0.6} />
      <Ink d={rope(110, MID - 20, 110, MID + 20, 2.2, 4)} p={p} from={0.24} to={0.3} w={0.3} />
      <TG t={nut}>
        <Ink d={circle(0, 0, 7) + line(-7, 0, 7, 0) + rings(0, 0, [4.5, 1.5]) + "M2 7L8 24L11 23L5 6"} p={p} from={0.22} to={0.28} w={0.7} />
      </TG>

      <motion.g style={{ opacity: boltOpacity }}>
        <TG t={boltPos}>
          <path d={bolt} fill="none" stroke="currentColor" strokeWidth={0.9} strokeLinecap="round" />
        </TG>
      </motion.g>
      <motion.path
        d="M480 252H600M470 260H600M480 268H600"
        stroke="currentColor"
        strokeWidth={0.8}
        strokeDasharray="10 8"
        className="text-sepia"
        style={{ opacity: streak }}
      />

      <Dim p={p} from={0.26} {...span} label="braccia quarantadue" until={0.36} />
      <Dim p={p} from={0.28} {...bed} label="lunghezza del letto" />
      <Micro
        p={p}
        from={0.3}
        x={18}
        y={40}
        size={6}
        lines={["Balestra grande, la quale si tende", "colla vite e col rocchetto;", "la noce si lascia col martello", "e la corda manda il dardo."]}
      />
      <Micro p={p} from={0.32} x={130} y={330} size={3.6} lines={["rote per traverso, acciò", "che stia salda nel tirare"]} />

      <Note p={p} from={0.24} x1={505} y1={170} x2={528} y2={108} text="arco" />
      <Note p={p} from={0.27} x1={136} y1={238} x2={84} y2={176} text="argano" anchor="end" />
      <Note p={p} from={0.3} x1={290} y1={300} x2={210} y2={380} text="ruote inclinate" anchor="end" />
      <Note p={p} from={0.33} x1={430} y1={258} x2={360} y2={150} text="la noce" anchor="end" until={0.5} />
    </>
  );
}
