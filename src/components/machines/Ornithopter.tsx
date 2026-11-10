"use client";

import { useTransform } from "motion/react";
import { Dim, Fibers, Ink, InkSet, Micro, Note, TG, Tone } from "@/components/ink";
import type { MachineProps } from "@/components/Exhibit";
import { circle, easeInOut, ellipse, hatch, line, range } from "@/lib/geo";
import {
  dimension,
  fibers,
  fibersLine,
  grainAlong,
  nudge,
  sampleCubic,
  sampleQuad,
  groundLitter,
  hatchBox,
  lash,
  member,
  radialTicks,
  rings,
  rivets,
  rope,
  stipple,
} from "@/lib/detail";

// ── Wing, in local coordinates with the shoulder pivot at (0, 0) ──────────────
// The leading spar runs almost level; finger ribs fan backward and down like a bat's.
const SPAR = "M0 0C70 -26 160 -34 244 -14";
const RIBS = ["M10 -4Q130 -8 236 26", "M8 0Q110 20 196 70", "M6 3Q80 38 140 96", "M4 5Q40 46 76 104"];
const SKIN_EDGE = "M244 -14Q248 8 236 26Q220 52 196 70Q172 92 140 96Q108 106 76 104Q38 92 6 30";
const SKIN_CLOSED = `${SPAR}Q248 8 236 26Q220 52 196 70Q172 92 140 96Q108 106 76 104Q38 92 6 30Z`;

const wingStructure = [SPAR, ...RIBS];
const wingSkin = [SKIN_EDGE, "M110 -30Q114 30 96 100", "M180 -32Q186 20 168 84"];
// Second edge of every member, so spars and ribs read as solid cane, not single lines.
const wingEdges = [
  "M2 5C72 -20 162 -28 242 -9",
  "M10 -1Q130 -5 236 29",
  "M8 3Q110 23 196 73",
  "M6 6Q80 41 140 99",
  "M4 8Q40 49 76 107",
].join("");
const sparGrain = "M1 2.5C71 -23 161 -31 243 -11.5M30 -7.5l12 -3.2M88 -19l14 -2.4M150 -26.5l16 -1M200 -23l14 2";
const fineRibs = "M9 -2Q120 6 216 48M7 1Q95 30 168 84M5 4Q60 42 108 102M3 6Q22 50 40 98";
const sparPoints: [number, number][] = [
  [40, -13],
  [76, -22],
  [120, -28],
  [160, -30],
  [200, -25],
];
const lashings = sparPoints.map(([x, y]) => lash(x - 4, y + 1, x + 4, y - 0.5, 6, 4)).join("");
const hinge = rings(0, 0, [3, 6, 9]) + radialTicks(0, 0, 6, 9, 8) + "M0 0h0.01";
const wingShade = hatch(36, -18, 12, 17, 5, 12);
const joints = circle(76, -26, 3) + circle(160, -32, 3);
const skinStipple = stipple(130, -16, 110, 9, 160, 21);

// Hairline cane fibres inside the spar and each rib.
const RIB_Q: [[number, number], [number, number], [number, number]][] = [
  [[10, -4], [130, -8], [236, 26]],
  [[8, 0], [110, 20], [196, 70]],
  [[6, 3], [80, 38], [140, 96]],
  [[4, 5], [40, 46], [76, 104]],
];
const makeWingFibers = () =>
  fibers(nudge(sampleCubic([0, 0], [70, -26], [160, -34], [244, -14], 40), 1, 2.5), 5, 3.2, 71, 0.55) +
  RIB_Q.map(([a, c, b], i) => fibers(nudge(sampleQuad(a, c, b, 30), 0, 1.5), 2.8, 1.6, 80 + i, 0.5)).join("");

function Wing({ p, side }: MachineProps & { side: string }) {
  const clip = `wing-skin-${side}`;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={SKIN_CLOSED} />
        </clipPath>
      </defs>
      {/* Canvas weave: scalloped seams echoing the trailing edge, and a crossing weft. */}
      <g clipPath={`url(#${clip})`} className="text-sepia">
        {[0.32, 0.44, 0.56, 0.68, 0.8, 0.9].map((s) => (
          <g key={s} transform={`scale(${s})`}>
            <Ink d={SKIN_EDGE} p={p} from={0.2 + s * 0.06} to={0.28 + s * 0.06} w={0.3 / s} opacity={0.75} />
          </g>
        ))}
        <Ink d={hatchBox(0, -40, 250, 150, 5, 62)} p={p} from={0.26} to={0.34} w={0.22} opacity={0.4} />
        <Ink d={hatchBox(0, 10, 130, 100, 3.2, -28)} p={p} from={0.28} to={0.35} w={0.22} opacity={0.45} />
      </g>
      {/* Two-colour print: a light ink screen over the membrane, spot red near the body. */}
      <Tone d={SKIN_CLOSED} p={p} from={0.24} to={0.34} density={15} />
      <Tone d="M6 3Q80 38 140 96Q108 106 76 104Q38 92 6 30Z" p={p} from={0.28} to={0.38} color="spot" density={30} />
      <InkSet paths={wingStructure} p={p} from={0.06} to={0.2} w={1.8} />
      <Ink d={wingEdges} p={p} from={0.12} to={0.24} w={0.6} />
      <Ink d={sparGrain} p={p} from={0.18} to={0.26} w={0.3} />
      <Fibers make={makeWingFibers} p={p} />
      <Ink d={fineRibs} p={p} from={0.16} to={0.26} w={0.4} opacity={0.8} />
      <InkSet paths={wingSkin} p={p} from={0.14} to={0.26} w={1} />
      <Ink d={wingShade} p={p} from={0.22} to={0.3} w={0.5} opacity={0.6} />
      <Ink d={lashings} p={p} from={0.22} to={0.3} w={0.45} />
      <Ink d={joints + hinge} p={p} from={0.2} to={0.26} w={0.8} />
      <Ink d={skinStipple} p={p} from={0.28} to={0.34} w={0.7} opacity={0.6} />
      <Micro p={p} from={0.3} x={120} y={46} lines={["tela di lino", "incollata"]} size={3.6} rotate={-8} />
    </>
  );
}

// ── Body: mast, crossbar, pulleys, rigging, cradle and rudder ───────────────────
const cradleY = (x: number) => 236 + 38 * (1 - ((x - 300) / 38) ** 2);
const cradlePlanks = Array.from({ length: 9 }, (_, i) => {
  const x = 268 + i * 8;
  return line(x, 236, x, cradleY(x) - 1);
}).join("");

const bodyDetail = [
  member(300, 150, 300, 340, 7),
  grainAlong(300, 152, 300, 338, 7, 3, 11, 1),
  member(236, 215, 364, 215, 6),
  grainAlong(238, 215, 362, 215, 6, 3, 12, 1),
  lash(238, 215, 248, 215, 6, 5),
  lash(352, 215, 362, 215, 6, 5),
  "M296 190h8M296 194h8M296 296h8M296 300h8",
].join("");
const bodyRivets = rivets(300, 192, 300, 192, 1, 1.3) + rivets(300, 298, 300, 298, 1, 1.3) + rivets(242, 215, 358, 215, 2, 1.1);
const pulleys =
  rings(300, 160, [7, 3]) +
  radialTicks(300, 160, 3, 7, 6) +
  "M288 146L300 160L312 146M288 146h24" +
  rings(300, 340, [4.5, 2]) +
  "M291 330L300 340L309 330";
const rigging =
  rope(292, 156, 240, 212, 2, 4) + rope(308, 156, 360, 212, 2, 4) + rope(294, 344, 266, 240, 1.6, 3.6) + rope(306, 344, 334, 240, 1.6, 3.6);
const cradle = "M268 240Q300 302 332 240M274 240Q300 292 326 240" + cradlePlanks;
const rudderFabric =
  Array.from({ length: 15 }, (_, i) => line(300, 362, 266 + i * 4.9, 430 - Math.abs(7 - i) * -0.6)).join("") +
  [0.3, 0.5, 0.7, 0.86].map((s) => `M${300 - 38 * s} ${362 + 66 * s}Q300 ${362 + 82 * s} ${300 + 38 * s} ${362 + 66 * s}`).join("");
const mastShade = hatch(305, 230, 9, 6, 6, 10) + hatch(304, 280, 6, 6, 5, 9);

const makeBodyFibers = () =>
  fibersLine(300, 151, 300, 339, 6.4, 6.4, 91) +
  fibersLine(237, 215, 363, 215, 5.4, 5.4, 92) +
  Array.from({ length: 8 }, (_, i) => {
    const x = 272 + i * 8;
    return fibersLine(x, 237, x, cradleY(x) - 1.5, 7, 7, 93 + i);
  }).join("");

const span = dimension(44, 196, 556, 196, -48);

// Flapping builds up, then the whole frame lifts off the page.
// Exported so the folio's living air can respond to the real wing pose.
export const flapAngle = (v: number) => {
  const t = range(v, 0.36, 1);
  const envelope = range(v, 0.36, 0.42);
  // Positive rotation dips the tip; bias slightly down so the upstroke never folds the wing.
  return Math.sin(t * Math.PI * 2 * 6) * 20 * envelope + 4 * envelope;
};
export const liftHeight = (v: number) =>
  easeInOut(range(v, 0.66, 1)) * -78 + Math.sin(range(v, 0.66, 1) * Math.PI * 12) * 3 * range(v, 0.66, 0.7);
/** Shoulder pivots of the two wings, before lift. */
export const WING_PIVOTS = { left: [288, 215], right: [312, 215] } as const;
/** Points along the wing (local coords) where air leaves it: tip and trailing edge. */
export const WING_EDGE: [number, number][] = [
  [244, -14],
  [236, 26],
  [196, 70],
  [140, 96],
  [76, 104],
];

export function Ornithopter({ p }: MachineProps) {
  const flap = flapAngle;
  const lift = liftHeight;

  const right = useTransform(p, (v) => `translate(312 215) rotate(${flap(v)})`);
  const left = useTransform(p, (v) => `translate(288 215) scale(-1 1) rotate(${flap(v)})`);
  const rise = useTransform(p, (v) => `translate(0 ${lift(v)})`);
  const shadow = useTransform(p, (v) => {
    const k = 1 - easeInOut(range(v, 0.66, 1)) * 0.45;
    return `translate(300 455) scale(${k} 1)`;
  });

  return (
    <>
      <TG t={shadow}>
        <Ink d={ellipse(0, 0, 130, 8)} p={p} from={0.26} to={0.32} w={0.7} opacity={0.5} />
        <Ink d={hatch(-110, -4, 14, 16, 8, 8)} p={p} from={0.28} to={0.33} w={0.5} opacity={0.35} />
        <Ink d={stipple(0, 0, 120, 7, 220, 5)} p={p} from={0.3} to={0.34} w={0.6} opacity={0.5} />
      </TG>
      <Ink d={line(70, 470, 530, 470)} p={p} from={0.02} to={0.1} w={0.6} opacity={0.4} />
      <Ink d={groundLitter(80, 520, 470, 4, 60)} p={p} from={0.08} to={0.16} w={0.4} opacity={0.6} />

      <Dim p={p} from={0.26} {...span} label="apertura dell’ali" until={0.36} />
      <Micro
        p={p}
        from={0.3}
        x={24}
        y={36}
        size={6}
        lines={[
          "Del volo degli uccelli.",
          "L’ala si muove per forza di corde",
          "e di leve, come fa il pipistrello",
          "che ha la pelle tra le dita.",
          "Fa’ le penne di canna e di tela,",
          "e salda con colla e seta cotta.",
        ]}
      />
      <Micro p={p} from={0.32} x={430} y={418} size={5} lines={["misura il peso dell’uomo", "e la forza delle braccia", "e de’ piedi"]} />

      <TG t={rise}>
        <TG t={left}>
          <Wing p={p} side="l" />
        </TG>
        <TG t={right}>
          <Wing p={p} side="r" />
        </TG>

        <Tone d="M262 236Q300 312 338 236Z" p={p} from={0.24} to={0.32} density={30} />
        <Tone d="M300 362L262 428Q300 444 338 428Z" p={p} from={0.26} to={0.36} color="spot" density={50} />
        <InkSet
          p={p}
          from={0.02}
          to={0.14}
          w={2}
          paths={[line(300, 150, 300, 340), line(236, 215, 364, 215), "M262 236Q300 312 338 236", "M262 236L338 236", "M286 340l14 22 14-22"]}
        />
        <Ink d={bodyDetail} p={p} from={0.12} to={0.24} w={0.4} />
        <Fibers make={makeBodyFibers} p={p} />
        <Ink d={bodyRivets} p={p} from={0.22} to={0.26} w={0.5} />
        <InkSet p={p} from={0.1} to={0.18} w={1.3} paths={[circle(300, 160, 10), circle(300, 215, 6), circle(300, 340, 7)]} />
        <Ink d={pulleys} p={p} from={0.16} to={0.24} w={0.5} />
        <Ink d={rigging} p={p} from={0.18} to={0.3} w={0.35} className="text-sepia" />
        <Ink d={cradle} p={p} from={0.18} to={0.26} w={0.4} />
        <InkSet
          p={p}
          from={0.16}
          to={0.26}
          w={1.2}
          paths={["M300 362L262 428Q300 444 338 428Z", "M300 362L282 434M300 362L300 437M300 362L318 434"]}
        />
        <Ink d={rudderFabric} p={p} from={0.24} to={0.32} w={0.25} opacity={0.8} />
        <Ink d={hatch(272, 248, 6, 10, 6, 18) + mastShade} p={p} from={0.2} to={0.28} w={0.4} opacity={0.7} />
        <Micro p={p} from={0.32} x={344} y={396} size={3.6} lines={["timone per voltare", "a destra e a sinistra"]} />

        <Note p={p} from={0.24} x1={470} y1={290} x2={462} y2={370} text="ala di pipistrello" />
        <Note p={p} from={0.27} x1={300} y1={160} x2={208} y2={118} text="carrucola" anchor="end" />
        <Note p={p} from={0.3} x1={314} y1={424} x2={380} y2={448} text="timone" />
      </TG>
    </>
  );
}
