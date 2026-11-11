"use client";

import { motion, useTransform } from "motion/react";
import { fell, rose, stepped, useCues } from "@/components/cues";
import { sound } from "@/lib/sound";
import { Dim, Fibers, Ink, InkSet, LivePath, Micro, Note, TG, Tone } from "@/components/ink";
import type { MachineProps } from "@/components/Exhibit";
import { circle, easeIn, hatch, line, range, spokes } from "@/lib/geo";
import { dimension, fibersLine, grainAlong, groundLitter, hatchBox, lash, member, radialTicks, rings, rivets, rivetsAt, stipple } from "@/lib/detail";

const PX = 300;
const PY = 250;
const LONG = 170;
const SHORT = 60;
const SLING = 46;
const RELEASE = 0.615;
const rad = (d: number) => (d * Math.PI) / 180;

/** Arm angle in degrees (0 = pointing right, y down), plus the sling angle. */
function pose(v: number) {
  const wind = range(v, 0.36, 0.5);
  const swing = easeIn(range(v, 0.5, 0.62));
  const settle = range(v, 0.62, 0.78);
  const arm = 155 - 6 * wind + Math.sin(wind * Math.PI * 9) * 0.6 * wind + 150 * swing - 12 * Math.sin(settle * Math.PI) * (1 - settle);
  const sling = 20 + (arm + 4 - 20) * swing;
  return { arm, sling };
}

function points(v: number) {
  const { arm, sling } = pose(v);
  const ex = PX + Math.cos(rad(arm)) * LONG;
  const ey = PY + Math.sin(rad(arm)) * LONG;
  const sx = PX + Math.cos(rad(arm + 180)) * SHORT;
  const sy = PY + Math.sin(rad(arm + 180)) * SHORT;
  const bx = ex + Math.cos(rad(sling)) * SLING;
  const by = ey + Math.sin(rad(sling)) * SLING;
  return { arm, ex, ey, sx, sy, bx, by };
}

const B0 = points(RELEASE);
const VX = 560;
const VY = -200;
const G = 880;
const ballAt = (t: number) => ({ x: B0.bx + VX * t, y: B0.by + VY * t + 0.5 * G * t * t });

// ── Frame ────────────────────────────────────────────────────────────────────
const frame = ["M130 398H470V412H130Z", line(206, 398, PX, PY), line(394, 398, PX, PY), line(242, 330, 358, 330), line(206, 398, 336, 300), line(394, 398, 264, 300)];
const frameDetail =
  member(206, 398, PX, PY, 8) +
  member(394, 398, PX, PY, 8) +
  grainAlong(208, 396, PX - 2, PY + 4, 8, 3, 201, 1) +
  grainAlong(392, 396, PX + 2, PY + 4, 8, 3, 202, 1) +
  grainAlong(132, 405, 468, 405, 13, 4, 203, 2) +
  member(242, 330, 358, 330, 5) +
  "M140 398V412M190 398V412M250 398V412M350 398V412M410 398V412M460 398V412";
const pegs =
  rings(PX, PY, [11, 4]) +
  radialTicks(PX, PY, 7, 11, 10) +
  rivetsAt(
    [
      [206, 400],
      [394, 400],
      [246, 330],
      [354, 330],
      [300, 315],
      [270, 375],
      [330, 375],
    ],
    1.6,
  );
const feet = "M196 398l-6 -14h14l6 14M404 398l6 -14h-14l-6 14" + rivets(198, 392, 204, 392, 2, 0.7) + rivets(396, 392, 402, 392, 2, 0.7);
const lashing = lash(296, 262, 304, 262, 10, 6);
const frameShade = hatch(214, 360, 10, 5, 8, 14) + hatch(320, 300, 8, 6, 8, 14);
const rollers = (x: number) => rings(x, 420, [12, 9, 3]) + spokes(x, 420, 9, 6) + radialTicks(x, 420, 12, 14, 18);

// ── Arm, in local coordinates along +x from the pivot ──────────────────────────
const ARM = `M${-SHORT} -7L${LONG} -3L${LONG} 3L${-SHORT} 7Z`;
const armDetail =
  grainAlong(-SHORT + 2, 0, LONG - 2, 0, 10, 4, 301, 2) +
  [-40, 20, 80, 140].map((x) => `M${x} -7V7M${x + 4} -7V7`).join("") +
  rivetsAt(
    [-38, 22, 82, 142].map((x): [number, number] => [x, 0]),
    1,
  ) +
  `M${LONG} 0l7 -5l3 2l-5 5` +
  rings(0, 0, [6.5]);

// ── Counterweight box, hanging below the short end ─────────────────────────────
const BOX = "M-28 24H28V74H-28Z";
const boxDetail =
  "M-28 36H28M-28 48H28M-28 60H28M-28 24L-24 20H24L28 24" +
  rivetsAt(
    [36, 48, 60].flatMap((y): [number, number][] => [
      [-24, y - 6],
      [24, y - 6],
    ]),
    0.8,
  ) +
  "M-28 24h6v6h-6M28 24h-6v6h6M-28 74h6v-6h-6M28 74h-6v-6h6" +
  stipple(0, 21, 22, 3, 40, 404);

// Hairline fibres along the legs, base, cross-beam, arm and box planks.
const makeFrameFibers = () =>
  fibersLine(207, 397, PX - 1, PY + 3, 7.2, 7.2, 900) +
  fibersLine(393, 397, PX + 1, PY + 3, 7.2, 7.2, 901) +
  fibersLine(131, 405, 469, 405, 12.4, 12.4, 902, 0.85) +
  fibersLine(243, 330, 357, 330, 4.4, 4.4, 903) +
  fibersLine(206, 398, 336, 300, 3, 3, 904) +
  fibersLine(394, 398, 264, 300, 3, 3, 905);
const makeArmFibers = () => fibersLine(-SHORT + 1, 0, LONG - 1, 0, 13, 5.4, 910);
const makeBoxFibers = () => [30, 42, 54, 67].map((y, i) => fibersLine(-27, y, 27, y, 10.5, 10.5, 920 + i, 0.75)).join("");

const baseDim = dimension(130, 432, 470, 432, 22);
const armDim = (() => {
  const c = points(0);
  return dimension(PX, PY, c.ex, c.ey, 14);
})();

export function Trebuchet({ p }: MachineProps) {
  useCues(p, (v, was, speed) => {
    // The winch winds the arm down the last few degrees, a click at a time.
    if (Math.max(v, was) > 0.36 && Math.min(v, was) < 0.5 && stepped(was, v, 0.0175, 0.36)) sound.tick(0.8, 0.8);
    // The catch is knocked out and the weight starts to fall.
    if (rose(was, v, 0.5)) sound.knock();
    // The arm whips over, fastest just before it lets go.
    if (rose(was, v, 0.575) || fell(was, v, 0.575)) sound.whoosh(Math.min(1, speed / 0.25), 0.4);
    // The sling opens and the stone is away.
    if (rose(was, v, RELEASE)) sound.twang(0.7);
    // The arm overshoots and rocks back on its axle.
    if (rose(was, v, 0.64)) sound.creak(0.9);
  });
  const arm = useTransform(p, (v) => `translate(${PX} ${PY}) rotate(${pose(v).arm})`);
  const weight = useTransform(p, (v) => {
    const pt = points(v);
    return `translate(${pt.sx} ${pt.sy})`;
  });
  const sling = useTransform(p, (v) => {
    const pt = points(v);
    if (v < RELEASE) return `M${pt.ex} ${pt.ey}L${pt.bx} ${pt.by}M${pt.ex + 1} ${pt.ey}L${pt.bx + 1} ${pt.by}`;
    // After release the empty sling just trails from the arm.
    const a = rad(pose(v).arm + 50);
    return `M${pt.ex} ${pt.ey}L${pt.ex + Math.cos(a) * SLING} ${pt.ey + Math.sin(a) * SLING}`;
  });
  const ball = useTransform(p, (v) => {
    if (v < RELEASE) {
      const pt = points(v);
      return `translate(${pt.bx} ${pt.by})`;
    }
    const b = ballAt(range(v, RELEASE, 0.9));
    return `translate(${b.x} ${b.y})`;
  });
  // The flight path, with small ticks marking equal intervals of time.
  const path = useTransform(p, (v) => {
    const end = range(v, RELEASE, 0.9);
    let d = `M${B0.bx} ${B0.by}`;
    let ticks = "";
    for (let i = 1; i <= 40; i++) {
      const t = (i / 40) * end;
      const b = ballAt(t);
      d += `L${Math.round(b.x)} ${Math.round(b.y)}`;
      if (i % 4 === 0) {
        const vy = VY + G * t;
        const len = Math.hypot(VX, vy);
        const nx = (-vy / len) * 4;
        const ny = (VX / len) * 4;
        ticks += `M${(b.x - nx).toFixed(1)} ${(b.y - ny).toFixed(1)}L${(b.x + nx).toFixed(1)} ${(b.y + ny).toFixed(1)}`;
      }
    }
    return d + ticks;
  });
  const pathOpacity = useTransform(p, [RELEASE, RELEASE + 0.01], [0, 1]);
  const slingOpacity = useTransform(p, [0.2, 0.24], [0, 1]);
  const ballOpacity = useTransform(p, [0.22, 0.26, 0.88, 0.9], [0, 1, 1, 0]);

  return (
    <>
      <Ink d={line(40, 432, 560, 432)} p={p} from={0.02} to={0.1} w={0.6} opacity={0.45} />
      <Ink d={hatch(60, 436, 30, 17, -8, 8)} p={p} from={0.06} to={0.14} w={0.5} opacity={0.3} />
      <Ink d={groundLitter(40, 560, 432, 51, 80)} p={p} from={0.1} to={0.18} w={0.4} opacity={0.6} />
      <Ink d={stipple(PX, 434, 190, 6, 260, 52)} p={p} from={0.14} to={0.2} w={0.6} opacity={0.4} />

      <Tone d="M130 398H470V412H130Z" p={p} from={0.2} to={0.28} density={30} />
      <InkSet paths={frame} p={p} from={0.02} to={0.16} w={1.8} />
      <Ink d={frameDetail} p={p} from={0.1} to={0.22} w={0.32} />
      <Fibers make={makeFrameFibers} p={p} />
      <Ink d={pegs + feet + lashing} p={p} from={0.18} to={0.26} w={0.5} />
      <Ink d={frameShade} p={p} from={0.2} to={0.26} w={0.45} opacity={0.6} />
      <InkSet paths={[circle(160, 420, 12), circle(440, 420, 12)]} p={p} from={0.1} to={0.16} w={1.4} />
      <Ink d={rollers(160) + rollers(440)} p={p} from={0.14} to={0.2} w={0.35} />
      <Ink d={hatch(140, 400, 19, 17, 6, 10)} p={p} from={0.14} to={0.2} w={0.5} opacity={0.6} />

      <motion.g style={{ opacity: pathOpacity }} className="text-rust">
        <LivePath d={path} strokeWidth={0.9} strokeDasharray="2 5" />
      </motion.g>

      <TG t={weight}>
        <Tone d={BOX} p={p} from={0.22} to={0.3} color="spot" density={50} />
        <InkSet p={p} from={0.12} to={0.22} w={1.5} paths={["M0 0L-14 24M0 0L14 24", BOX]} />
        <defs>
          <clipPath id="treb-box">
            <path d={BOX} />
          </clipPath>
        </defs>
        <g clipPath="url(#treb-box)">
          <Ink d={hatchBox(-28, 24, 56, 50, 3, 70)} p={p} from={0.2} to={0.28} w={0.25} opacity={0.6} />
        </g>
        <Ink d={boxDetail + "M0 0h0.01" + rings(0, 0, [3])} p={p} from={0.18} to={0.26} w={0.45} />
        <Fibers make={makeBoxFibers} p={p} />
      </TG>

      <TG t={arm}>
        <Tone d={ARM} p={p} from={0.2} to={0.28} density={15} />
        <Ink d={ARM} p={p} from={0.08} to={0.18} w={1.8} />
        <Ink d={armDetail} p={p} from={0.16} to={0.24} w={0.35} />
        <Fibers make={makeArmFibers} p={p} />
        <Ink d={hatch(-50, -4, 12, 18, 6, 8)} p={p} from={0.16} to={0.22} w={0.5} opacity={0.6} />
      </TG>
      <motion.g style={{ opacity: slingOpacity }} className="text-sepia">
        <LivePath d={sling} strokeWidth={0.6} />
      </motion.g>
      <motion.g style={{ opacity: ballOpacity }}>
        <TG t={ball}>
          <circle r={7} fill="currentColor" />
          <path d="M-3 -3a4 4 0 0 1 4 -2" stroke="var(--color-paper)" strokeWidth={0.8} fill="none" opacity={0.6} />
        </TG>
      </motion.g>
      <Ink d={circle(PX, PY, 7)} p={p} from={0.16} to={0.2} w={1.6} />

      <Dim p={p} from={0.26} {...baseDim} label="lunghezza della base" />
      <Dim p={p} from={0.28} {...armDim} label="braccio lungo" until={0.48} />
      <Micro
        p={p}
        from={0.3}
        x={18}
        y={40}
        size={6}
        lines={["Il trabocco tira per lo contrappeso;", "quanto più cade il peso,", "tanto più veloce va la pietra,", "e la fionda allunga il braccio."]}
      />
      <Micro p={p} from={0.82} x={500} y={128} size={4} lines={["la pietra fa", "la linea curva"]} />

      <Note p={p} from={0.24} x1={PX} y1={PY} x2={196} y2={196} text="perno" anchor="end" />
      <Note p={p} from={0.27} x1={378} y1={268} x2={470} y2={226} text="contrappeso" until={0.48} />
      <Note p={p} from={0.3} x1={points(0).bx} y1={points(0).by} x2={110} y2={380} text="fionda" anchor="end" until={0.48} />
      <Note p={p} from={0.33} x1={250} y1={330} x2={180} y2={352} text="telaio" anchor="end" />
      <Note p={p} from={0.8} x1={ballAt(0.27).x} y1={ballAt(0.27).y} x2={566} y2={78} text="la linea del tiro" anchor="end" />
    </>
  );
}
