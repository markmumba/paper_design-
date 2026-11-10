"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { Dim, Fibers, Ink, InkSet, Micro, Note, TG, Tone } from "@/components/ink";
import type { MachineProps } from "@/components/Exhibit";
import { circle, easeInOut, ellipse, gear, halfEllipse, hatch, line, range, spokes } from "@/lib/geo";
import {
  arcPoly,
  dimension,
  fibersLine,
  groundLitter,
  hatchBox,
  onEllipse,
  radialTicks,
  rings,
  rivetsAt,
  stipple,
} from "@/lib/detail";

const CX = 300;
const BASE_Y = 315;
const APEX_Y = 152;
const RX = 205;
const RY = 40;
const WHEELS = [175, 255, 345, 425];
const WHEEL_Y = 372;
const WHEEL_R = 30;

// Cannons poke out of the skirt all around the front half.
const CANNON_ANGLES = [0.82, 0.66, 0.5, 0.34, 0.18].map((k) => k * Math.PI);
const cannons = CANNON_ANGLES.map((th) => {
  const bx = CX + Math.cos(th) * RX;
  const by = BASE_Y + 13 + Math.sin(th) * RY;
  const len = Math.hypot(Math.cos(th), Math.sin(th) * 0.35);
  const ux = Math.cos(th) / len;
  const uy = (Math.sin(th) * 0.35) / len;
  return { bx, by, tx: bx + ux * 28, ty: by + uy * 28, ux, uy };
});

/** A bronze barrel: tapered outline, reinforcing bands, muzzle and touch-hole. */
function barrel(c: (typeof cannons)[number]) {
  const nx = -c.uy;
  const ny = c.ux;
  const pt = (a: number, b: number) => `${(c.bx + c.ux * a + nx * b).toFixed(2)} ${(c.by + c.uy * a + ny * b).toFixed(2)}`;
  let d = `M${pt(0, -4.2)}L${pt(28, -3.2)}M${pt(0, 4.2)}L${pt(28, 3.2)}M${pt(28, -3.6)}L${pt(28, 3.6)}`;
  for (const a of [3, 10, 18, 25]) d += `M${pt(a, -4.4)}L${pt(a, 4.4)}`;
  d += `M${pt(26, -1.4)}L${pt(26, 1.4)}M${pt(5, -1)}h0.01`;
  return d;
}

// ── Cone shell ───────────────────────────────────────────────────────────────
const coneRx = (y: number) => 16 + ((RX - 16) * (y - APEX_Y)) / (BASE_Y - APEX_Y);
const shell = [
  line(95, BASE_Y, 284, APEX_Y),
  line(505, BASE_Y, 316, APEX_Y),
  ...[0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86].map((k) => {
    const th = k * Math.PI;
    return line(CX + Math.cos(th) * RX, BASE_Y + Math.sin(th) * RY, CX + Math.cos(th) * 16, APEX_Y);
  }),
];
// Fine plank seams between the main ribs.
const seams = Array.from({ length: 24 }, (_, i) => {
  const th = (0.04 + i * 0.04) * Math.PI;
  return line(CX + Math.cos(th) * RX, BASE_Y + Math.sin(th) * RY, CX + Math.cos(th) * 16, APEX_Y);
}).join("");
// Iron hoops binding the planks, each studded with rivets.
const HOOPS = [182, 214, 248, 284];
const hoops = HOOPS.map((y) => {
  const rx = coneRx(y);
  return halfEllipse(CX, y, rx, (RY * rx) / RX) + halfEllipse(CX, y + 3, rx + 1.6, (RY * (rx + 1.6)) / RX);
}).join("");
const hoopRivets = rivetsAt(
  HOOPS.flatMap((y) => {
    const rx = coneRx(y) + 0.8;
    return Array.from({ length: 13 }, (_, i) => onEllipse(CX, y + 1.5, rx, (RY * rx) / RX, (0.08 + i * 0.07) * Math.PI));
  }),
  0.9,
);
const CONE_CLIP = `M95 ${BASE_Y}L284 ${APEX_Y}L316 ${APEX_Y}L505 ${BASE_Y}A${RX} ${RY} 0 0 1 95 ${BASE_Y}Z`;
const coneShade = hatchBox(370, 140, 150, 220, 3.2, 62);
const coneShade2 = hatchBox(430, 220, 90, 120, 3.6, -30);
const slits =
  "M226 228l18 -4l0.6 3.4l-18 4zM228 229.4l14 -3.2M354 224l18 4l-0.6 3.4l-18 -4zM356 225.6l14 3.2M288 194h24v4h-24zM290 196h20";

const turret = [ellipse(CX, 150, 16, 5), line(284, 150, 284, 120), line(316, 150, 316, 120), ellipse(CX, 120, 16, 5), "M284 120L300 100L316 120"];
const turretDetail =
  Array.from({ length: 7 }, (_, i) => line(287 + i * 4.3, 122 + Math.abs(3 - i) * 0.4, 287 + i * 4.3, 152 - Math.abs(3 - i) * 0.4)).join("") +
  rivetsAt(Array.from({ length: 6 }, (_, i) => onEllipse(CX, 135, 16, 5, (0.12 + i * 0.15) * Math.PI)), 0.8) +
  "M288 116L300 104M292 118L300 108M300 100V72M300 72Q312 75 324 73Q313 79 300 84M302 76Q310 77 318 75";

// ── Skirt band ───────────────────────────────────────────────────────────────
const skirt = [ellipse(CX, BASE_Y, RX, RY), halfEllipse(CX, BASE_Y + 25, RX, RY), line(95, BASE_Y, 95, BASE_Y + 25), line(505, BASE_Y, 505, BASE_Y + 25)];
const skirtPlanks = Array.from({ length: 34 }, (_, i) => {
  const th = (0.03 + i * 0.0285) * Math.PI;
  const [x, y] = onEllipse(CX, BASE_Y, RX, RY, th);
  return line(x, y + 1, x, y + 24);
}).join("");
const skirtDetail =
  arcPoly(CX, BASE_Y - 1, RX - 4, RY - 1, Math.PI, Math.PI * 2, 40) +
  arcPoly(CX, BASE_Y + 6, RX, RY, 0.02 * Math.PI, 0.98 * Math.PI, 40) +
  arcPoly(CX, BASE_Y + 20, RX, RY, 0.02 * Math.PI, 0.98 * Math.PI, 40);
const skirtRivets = rivetsAt(
  Array.from({ length: 22 }, (_, i) => onEllipse(CX, BASE_Y + 3, RX, RY, (0.05 + i * 0.043) * Math.PI)),
  0.8,
);

// Hairline fibres along every shell plank (tapering to the apex), skirt board and turret stave.
const makeShellFibers = () =>
  Array.from({ length: 23 }, (_, i) => {
    const a = (0.04 + i * 0.04) * Math.PI;
    const b = a + 0.04 * Math.PI;
    const c = (a + b) / 2;
    const [ax, ay] = onEllipse(CX, BASE_Y, RX, RY, a);
    const [bx, by] = onEllipse(CX, BASE_Y, RX, RY, b);
    const [cx, cy] = onEllipse(CX, BASE_Y, RX, RY, c);
    const wBase = Math.hypot(bx - ax, by - ay) * 0.9;
    const wTop = Math.max(0.6, 32 * Math.sin(0.02 * Math.PI) * Math.abs(Math.sin(c)));
    return fibersLine(cx, cy - 1, CX + Math.cos(c) * 16, APEX_Y + 2, wBase, wTop, 500 + i, 2.2);
  }).join("") +
  Array.from({ length: 6 }, (_, i) => fibersLine(289 + i * 4.3, 124, 289 + i * 4.3, 150, 3.6, 3.6, 540 + i, 0.6)).join("");
const makeSkirtFibers = () =>
  Array.from({ length: 33 }, (_, i) => {
    const th = (0.03 + i * 0.0285 + 0.01425) * Math.PI;
    const [x, y] = onEllipse(CX, BASE_Y, RX, RY, th);
    const w = Math.max(1, RX * 0.0285 * Math.PI * Math.abs(Math.sin(th)) * 0.85);
    return fibersLine(x, y + 1.5, x, y + 23.5, w, w, 560 + i, 1);
  }).join("");

const puff = circle(0, 0, 10) + circle(11, -7, 8) + circle(-9, -6, 7) + circle(4, -14, 6);
const puffDetail = stipple(2, -6, 16, 12, 40, 77) + "M-4 -2c3 -3 6 -2 8 0M6 -10c2 -2 5 -1 6 1";

const width = dimension(95, 404, 505, 404, 18);

function Puff({ p, at, x, y }: MachineProps & { at: number; x: number; y: number }) {
  const t = useTransform(p, (v) => {
    const s = range(v, at, at + 0.08);
    return `translate(${x} ${y}) scale(${0.2 + s * 1.8})`;
  });
  const opacity = useTransform(p, [at, at + 0.01, at + 0.08], [0, 1, 0]);
  return (
    <motion.g style={{ opacity }} className="text-sepia">
      <TG t={t}>
        <path d={puff} fill="none" stroke="currentColor" strokeWidth={1} />
        <path d={puffDetail} fill="none" stroke="currentColor" strokeWidth={0.5} strokeLinecap="round" />
      </TG>
    </motion.g>
  );
}

function Wheel({ p, x, i, turn }: MachineProps & { x: number; i: number; turn: MotionValue<number> }) {
  const t = useTransform(turn, (deg) => `rotate(${deg} ${x} ${WHEEL_Y})`);
  const detail =
    rings(x, WHEEL_Y, [WHEEL_R - 4, 8, 5]) +
    radialTicks(x, WHEEL_Y, WHEEL_R, WHEEL_R + 2.5, 28) +
    spokes(x, WHEEL_Y, WHEEL_R - 4, 8, Math.PI / 8 + 0.06) +
    rivetsAt(Array.from({ length: 6 }, (_, k) => [x + Math.cos((k * Math.PI) / 3) * 6.5, WHEEL_Y + Math.sin((k * Math.PI) / 3) * 6.5]), 0.6);
  return (
    <TG t={t}>
      <Ink d={circle(x, WHEEL_Y, WHEEL_R)} p={p} from={0.04 + i * 0.02} to={0.1 + i * 0.02} w={1.6} />
      <Ink d={spokes(x, WHEEL_Y, WHEEL_R, 8) + circle(x, WHEEL_Y, 5)} p={p} from={0.1 + i * 0.02} to={0.16 + i * 0.02} w={0.8} />
      <Ink d={detail} p={p} from={0.16 + i * 0.015} to={0.24 + i * 0.015} w={0.35} />
    </TG>
  );
}

export function Tank({ p }: MachineProps) {
  const roll = (v: number) => easeInOut(range(v, 0.36, 0.58)) * 64 - 40;
  const lift = (v: number) => easeInOut(range(v, 0.5, 0.62)) * -118 + easeInOut(range(v, 0.92, 1)) * 118;
  const crank = (v: number) => range(v, 0.36, 1) * 900;

  const body = useTransform(p, (v) => `translate(${roll(v)} 0)`);
  const top = useTransform(p, (v) => `translate(0 ${lift(v)})`);
  const wheelTurn = useTransform(p, (v) => ((roll(v) + 40) / WHEEL_R) * (180 / Math.PI));
  const bigGear = useTransform(p, (v) => `rotate(${crank(v)} 255 262)`);
  const smallGear = useTransform(p, (v) => `rotate(${-crank(v) * 1.6 + 9} 325 262)`);
  const crankArm = useTransform(p, (v) => `rotate(${-crank(v) * 1.6} 325 262)`);
  const innards = useTransform(p, [0.52, 0.6, 0.9, 0.96], [0, 1, 1, 0]);
  const recoil = useTransform(p, (v) => {
    const k = CANNON_ANGLES.reduce((m, _, i) => Math.max(m, 1 - Math.abs(range(v, 0.72 + i * 0.03, 0.76 + i * 0.03) - 0.25) * 4), 0);
    return `translate(0 ${Math.max(0, k) * 2})`;
  });

  return (
    <>
      <Ink d={line(40, 404, 560, 404)} p={p} from={0.02} to={0.1} w={0.6} opacity={0.45} />
      <Ink d={hatch(60, 408, 30, 17, -8, 8)} p={p} from={0.06} to={0.14} w={0.5} opacity={0.3} />
      <Ink d={groundLitter(40, 560, 404, 31, 80)} p={p} from={0.1} to={0.18} w={0.4} opacity={0.6} />

      <Micro
        p={p}
        from={0.3}
        x={18}
        y={34}
        size={6}
        lines={[
          "Item, farò carri coperti, securi",
          "et inoffensibili, e quali intrando",
          "intra li nimici con sue artiglierie,",
          "non è sì grande moltitudine di gente",
          "d’arme che non rompessino.",
          "E dietro a questi poteranno seguire",
          "fanterie assai illesi.",
        ]}
      />

      <TG t={body}>
        {/* The drive train, only visible once the shell is lifted away. */}
        <motion.g style={{ opacity: innards }} className="text-sepia">
          <TG t={bigGear}>
            <path d={gear(255, 262, 46, 16)} fill="none" stroke="currentColor" strokeWidth={1.4} />
            <path
              d={spokes(255, 262, 36, 6) + rings(255, 262, [8, 12, 36, 39]) + radialTicks(255, 262, 12, 36, 6, Math.PI / 6) + stipple(255, 262, 30, 30, 60, 12)}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
              strokeLinecap="round"
            />
          </TG>
          <TG t={smallGear}>
            <path d={gear(325, 262, 28, 10)} fill="none" stroke="currentColor" strokeWidth={1.4} />
            <path d={spokes(325, 262, 20, 4) + rings(325, 262, [6, 9, 20, 22.5])} fill="none" stroke="currentColor" strokeWidth={0.5} />
          </TG>
          <TG t={crankArm}>
            <path d={line(325, 262, 325, 218) + line(322, 262, 322, 218) + circle(325, 212, 6) + circle(325, 212, 3)} fill="none" stroke="currentColor" strokeWidth={1.2} />
          </TG>
          <path d={line(255, 262, 255, WHEEL_Y) + line(251, 262, 251, WHEEL_Y)} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" />
          <Micro p={p} from={0.56} x={200} y={318} size={4} lines={["l’omo gira la manovella", "e la rota maggiore", "volta le rote del carro"]} until={0.88} />
        </motion.g>

        <Ink d={stipple(CX, 404, 210, 7, 280, 41)} p={p} from={0.14} to={0.2} w={0.6} opacity={0.45} />
        {WHEELS.map((x, i) => (
          <Wheel key={x} p={p} x={x} i={i} turn={wheelTurn} />
        ))}

        <Tone d={`M95 ${BASE_Y}A${RX} ${RY} 0 0 0 505 ${BASE_Y}L505 ${BASE_Y + 25}A${RX} ${RY} 0 0 1 95 ${BASE_Y + 25}Z`} p={p} from={0.2} to={0.3} color="spot" density={50} />
        <InkSet paths={skirt} p={p} from={0.02} to={0.14} w={1.6} />
        <Ink d={skirtPlanks + skirtDetail} p={p} from={0.12} to={0.22} w={0.35} />
        <Ink d={skirtRivets} p={p} from={0.2} to={0.26} w={0.5} />
        <Fibers make={makeSkirtFibers} p={p} />
        <TG t={recoil}>
          {cannons.map((c, i) => (
            <g key={i}>
              <Ink d={barrel(c)} p={p} from={0.16 + i * 0.015} to={0.22 + i * 0.015} w={0.9} />
              <Ink d={circle(c.tx, c.ty, 3.4) + circle(c.tx, c.ty, 1.6)} p={p} from={0.19 + i * 0.015} to={0.21 + i * 0.015} w={0.7} />
            </g>
          ))}
        </TG>
        {cannons.map((c, i) => (
          <Puff key={i} p={p} at={0.72 + i * 0.03} x={c.tx + c.ux * 16} y={c.ty + c.uy * 16} />
        ))}

        <TG t={top}>
          <defs>
            <clipPath id="tank-cone">
              <path d={CONE_CLIP} />
            </clipPath>
          </defs>
          <g clipPath="url(#tank-cone)">
            <Ink d={coneShade} p={p} from={0.24} to={0.32} w={0.25} opacity={0.6} />
            <Ink d={coneShade2} p={p} from={0.28} to={0.34} w={0.22} opacity={0.5} />
          </g>
          <Tone d={`M300 ${APEX_Y}L316 ${APEX_Y}L505 ${BASE_Y}A${RX} ${RY} 0 0 1 300 ${BASE_Y + RY}Z`} p={p} from={0.24} to={0.34} density={30} />
          <Tone d="M284 120H316V150H284Z" p={p} from={0.26} to={0.34} color="spot" density={70} />
          <InkSet paths={shell} p={p} from={0.08} to={0.22} w={1.4} />
          <Ink d={seams} p={p} from={0.14} to={0.24} w={0.3} />
          <Fibers make={makeShellFibers} p={p} />
          <Ink d={hoops} p={p} from={0.18} to={0.26} w={0.5} />
          <Ink d={hoopRivets} p={p} from={0.24} to={0.3} w={0.45} />
          <InkSet paths={turret} p={p} from={0.16} to={0.24} w={1.4} />
          <Ink d={turretDetail} p={p} from={0.22} to={0.28} w={0.4} />
          <Ink d={slits} p={p} from={0.22} to={0.26} w={0.7} />
        </TG>

        <Dim p={p} from={0.26} {...width} label="diametro del carro" until={0.36} />

        <Note p={p} from={0.24} x1={214} y1={238} x2={128} y2={178} text="guscio" anchor="end" until={0.48} />
        <Note p={p} from={0.27} x1={316} y1={128} x2={398} y2={92} text="torretta" until={0.48} />
        <Note p={p} from={0.3} x1={cannons[0].tx} y1={cannons[0].ty} x2={58} y2={444} text="bombarde" />
        <Note p={p} from={0.32} x1={436} y1={396} x2={472} y2={446} text="ruote" />
        <Note p={p} from={0.56} x1={226} y1={236} x2={150} y2={196} text="ingranaggi" anchor="end" until={0.88} />
        <Note p={p} from={0.6} x1={325} y1={212} x2={410} y2={176} text="manovella" until={0.88} />
      </TG>
    </>
  );
}
