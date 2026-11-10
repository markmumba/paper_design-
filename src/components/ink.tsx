"use client";

import { motion, motionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useMemo, useRef, useSyncExternalStore, type ReactNode, type SVGProps } from "react";

type InkProps = {
  d: string;
  /** Scroll progress (0..1) driving the drawing. */
  p: MotionValue<number>;
  from?: number;
  to?: number;
  w?: number;
  className?: string;
  fill?: string;
  opacity?: number;
};

/** A single pen stroke that draws itself between `from` and `to` progress. */
export function Ink({ d, p, from = 0, to = 0.3, w = 1.4, className, fill = "none", opacity = 1 }: InkProps) {
  const reduce = useReducedMotion();
  const length = useTransform(p, [from, to], [0, 1], { clamp: true });
  // Hide the stroke entirely until it starts so round caps don't leave dots.
  const visible = useTransform(p, [from, from + 0.002], [0, opacity], { clamp: true });
  const fillOpacity = useTransform(p, [to - (to - from) * 0.3, to], [0, 1], { clamp: true });

  return (
    <motion.path
      d={d}
      fill={fill}
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={
        reduce
          ? { opacity }
          : { pathLength: length, opacity: visible, fillOpacity: fill === "none" ? undefined : fillOpacity }
      }
    />
  );
}

type InkSetProps = Omit<InkProps, "d"> & { paths: string[] };

/** Several strokes drawn one after another, overlapping a little like a real hand. */
export function InkSet({ paths, from = 0, to = 0.3, ...rest }: InkSetProps) {
  const n = paths.length;
  const span = to - from;
  const dur = n > 1 ? span * 0.4 : span;
  return (
    <>
      {paths.map((d, i) => {
        const start = n > 1 ? from + ((span - dur) * i) / (n - 1) : from;
        return <Ink key={i} d={d} from={start} to={start + dur} {...rest} />;
      })}
    </>
  );
}

/** A <g> whose transform attribute follows a motion value (pivot-safe rotations). */
export function TG({ t, children, ...rest }: { t: MotionValue<string>; children: ReactNode } & SVGProps<SVGGElement>) {
  const ref = useRef<SVGGElement>(null);
  useMotionValueEvent(t, "change", (v) => ref.current?.setAttribute("transform", v));
  return (
    <g ref={ref} transform={t.get()} {...rest}>
      {children}
    </g>
  );
}

/**
 * A path whose `d` is recomputed from a motion value every frame.
 * Pass `draw` (0..1) to ink it in progressively like <Ink>.
 */
export function LivePath({
  d,
  draw,
  ...rest
}: { d: MotionValue<string>; draw?: MotionValue<number> } & Omit<SVGProps<SVGPathElement>, "d">) {
  const ref = useRef<SVGPathElement>(null);
  const reduce = useReducedMotion();
  useMotionValueEvent(d, "change", (v) => ref.current?.setAttribute("d", v));
  const applyDraw = (v: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.strokeDasharray = `${v} 1`;
    el.style.opacity = v < 0.002 ? "0" : "";
  };
  useMotionValueEvent(draw ?? ZERO, "change", (v) => !reduce && applyDraw(v));
  const initial = draw && !reduce ? draw.get() : 1;
  return (
    <path
      ref={ref}
      d={d.get()}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(draw ? { pathLength: 1, style: { strokeDasharray: `${initial} 1`, opacity: initial < 0.002 ? 0 : undefined } } : {})}
      {...rest}
    />
  );
}

// useMotionValueEvent needs a motion value even when `draw` is omitted.
const ZERO = motionValue(0);

/** A handwritten margin note with a leader line pointing at a part. */
/** English for every Italian margin label, shown beneath it. */
const GLOSS: Record<string, string> = {
  "ala di pipistrello": "bat's wing",
  aperta: "open",
  denti: "teeth",
  "la metà segata": "the sawn half",
  "le cavità": "the hollows",
  chiusa: "shut",
  "cinque dei lombi": "five of the loins",
  "dodici del dorso": "twelve of the back",
  "i vortici": "the eddies",
  "il centro del quadrato": "centre of the square",
  "il cerchio": "the circle",
  "il seno": "the sinus",
  "l’aorta": "the aorta",
  "l’ombelico": "the navel",
  "l’osso sacro": "the sacrum",
  "la valvola": "the valve",
  "le tre linee": "the three lines",
  mascella: "jaw",
  occhio: "eye socket",
  segato: "sawn off",
  "sette del collo": "seven of the neck",
  "una spina di troppo": "one spine too many",
  albero: "mast",
  arco: "bow",
  argano: "winch",
  bombarde: "cannons",
  carrucola: "pulley",
  contrappeso: "counterweight",
  fionda: "sling",
  guscio: "shell",
  "i garzoni spingono": "the crew push",
  ingranaggi: "gears",
  "la linea del tiro": "path of the shot",
  "la noce": "trigger nut",
  "lino inamidato": "starched linen",
  manovella: "crank",
  perno: "pivot",
  ruote: "wheels",
  "ruote inclinate": "splayed wheels",
  telaio: "frame",
  timone: "rudder",
  torretta: "lookout turret",
  vite: "screw",
};

export function Note({
  p,
  from,
  x1,
  y1,
  x2,
  y2,
  text,
  anchor = "start",
  until,
}: {
  p: MotionValue<number>;
  from: number;
  /** Fade the note out again at this progress (for parts that move away). */
  until?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  anchor?: "start" | "end" | "middle";
}) {
  const opacity = useTransform(p, [from + 0.04, from + 0.09], [0, 1], { clamp: true });
  const dx = anchor === "end" ? -6 : anchor === "start" ? 6 : 0;
  const stay = useTransform(p, until ? [until, until + 0.04] : [0, 1], until ? [1, 0] : [1, 1], { clamp: true });
  return (
    <motion.g className="spot-layer text-spot" style={{ opacity: stay }}>
      <Ink d={`M${x1} ${y1}Q${(x1 + x2) / 2 + 8} ${(y1 + y2) / 2 - 10} ${x2} ${y2}`} p={p} from={from} to={from + 0.06} w={0.9} />
      <motion.circle cx={x1} cy={y1} r={2.2} fill="currentColor" style={{ opacity }} />
      <motion.text
        x={x2 + dx}
        y={y2 + 5}
        textAnchor={anchor}
        fill="currentColor"
        style={{ opacity, fontFamily: "var(--font-aurore)", fontSize: 17 }}
      >
        {text}
      </motion.text>
      {GLOSS[text] && (
        <motion.text
          x={x2 + dx}
          y={y2 + 19}
          textAnchor={anchor}
          className="fill-faded"
          style={{ opacity, fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontSize: 11 }}
        >
          {GLOSS[text]}
        </motion.text>
      )}
    </motion.g>
  );
}

/**
 * Tiny handwritten notes, mirror-written like Leonardo's. Barely legible at
 * normal size; meant to be found with the magnifier.
 */
export function Micro({
  p,
  from,
  x,
  y,
  lines,
  size = 5,
  mirror = true,
  rotate = 0,
  until,
  by = "ours",
  cite,
}: {
  p: MotionValue<number>;
  from: number;
  x: number;
  y: number;
  lines: string[];
  size?: number;
  mirror?: boolean;
  rotate?: number;
  until?: number;
  /** Whose words these are: Leonardo's (give `cite`), or ours in his manner. */
  by?: "leonardo" | "ours";
  cite?: string;
}) {
  const opacity = useTransform(
    p,
    until ? [from, from + 0.05, until, until + 0.04] : [from, from + 0.05],
    until ? [0, 0.85, 0.85, 0] : [0, 0.85],
    { clamp: true },
  );
  return (
    <motion.g style={{ opacity }} className="text-sepia">
      <g transform={`translate(${x} ${y}) rotate(${rotate})${mirror ? " scale(-1 1)" : ""}`}>
        {lines.map((l, i) => (
          <text
            key={i}
            x={0}
            y={i * size * 1.5}
            textAnchor={mirror ? "end" : "start"}
            fill="currentColor"
            style={{ fontFamily: "var(--font-aurore)", fontSize: size }}
          >
            {l}
          </text>
        ))}
      </g>
      {/* A plain, unmirrored credit beneath, so nothing passes for Leonardo's that isn't. */}
      <text
        x={x}
        y={y + lines.length * size * 1.5 + size * 0.6}
        transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
        className={by === "leonardo" ? "fill-sepia" : "fill-rust"}
        style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontSize: Math.max(4, size * 0.85) }}
      >
        {by === "leonardo" ? `— Leonardo${cite ? `, ${cite}` : ""}` : "— our note, written in his manner"}
      </text>
    </motion.g>
  );
}

/** A ruled dimension with a small label, in the faded ink of construction lines. */
export function Dim({
  p,
  from,
  d,
  mid,
  angle,
  label,
  until,
}: {
  p: MotionValue<number>;
  from: number;
  d: string;
  mid: [number, number];
  angle: number;
  label: string;
  until?: number;
}) {
  const opacity = useTransform(p, [from + 0.05, from + 0.08], [0, 1], { clamp: true });
  const stay = useTransform(p, until ? [until, until + 0.04] : [0, 1], until ? [1, 0] : [1, 1], { clamp: true });
  const a = angle > 90 || angle < -90 ? angle + 180 : angle;
  return (
    <motion.g className="text-faded" style={{ opacity: stay }}>
      <Ink d={d} p={p} from={from} to={from + 0.08} w={0.45} />
      <motion.text
        transform={`translate(${mid[0]} ${mid[1]}) rotate(${a}) translate(0 -4)`}
        textAnchor="middle"
        fill="currentColor"
        style={{ opacity, fontFamily: "var(--font-fell)", fontStyle: "italic", fontSize: 8 }}
      >
        {label}
      </motion.text>
    </motion.g>
  );
}

// ── Halftone ────────────────────────────────────────────────────────────────
const SPOT = "#e4572e";
const INK = "#3a2717";
export type ToneColor = "ink" | "spot";
const DENSITIES = [15, 30, 50, 70] as const;
export type ToneDensity = (typeof DENSITIES)[number];
const HALFTONES = (["ink", "spot"] as const).flatMap((c) =>
  DENSITIES.map((d) => ({
    id: `ht-${c}-${d}`,
    color: c === "ink" ? INK : SPOT,
    density: d / 100,
    angle: c === "ink" ? 45 : 15,
    cell: c === "ink" ? 3.2 : 3.6,
  })),
);

/**
 * A halftone-screened area that prints in as the drawing progresses. Spot
 * tones sit on the misregistered spot plate and overprint the black.
 */
export function Tone({
  d,
  p,
  from,
  to,
  color = "ink",
  density = 30,
  clip,
}: {
  d: string;
  p: MotionValue<number>;
  from: number;
  to: number;
  color?: ToneColor;
  density?: ToneDensity;
  clip?: string;
}) {
  const reduce = useReducedMotion();
  const opacity = useTransform(p, [from, to], [0, 1], { clamp: true });
  const path = (
    <motion.path d={d} fill={`url(#ht-${color}-${density})`} stroke="none" style={{ opacity: reduce ? 1 : opacity }} clipPath={clip ? `url(#${clip})` : undefined} />
  );
  return color === "spot" ? <g className="spot-layer">{path}</g> : path;
}

const noopSubscribe = () => () => {};

/**
 * Hairline wood fibres. Generated lazily and only on the client, so the
 * thousands of tiny strokes never bloat the server-rendered HTML.
 */
export function Fibers({ make, p, from = 0.28, to = 0.38 }: { make: () => string; p: MotionValue<number>; from?: number; to?: number }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const d = useMemo(() => (mounted ? make() : ""), [mounted, make]);
  if (!d) return null;
  return <Ink d={d} p={p} from={from} to={to} w={0.11} opacity={0.6} className="text-sepia" />;
}

/** Shared SVG filters: a slight wobble so ruler-straight lines feel hand-inked. */
export function InkFilters() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        {/* Halftone screens. Ink is screened at 45°, the spot colour at 15°, as on
            a real two-drum riso, so where they overlap they form a rosette. */}
        {HALFTONES.map(({ id, color, density, angle, cell }) => (
          <pattern key={id} id={id} width={cell} height={cell} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
            <circle cx={cell / 2} cy={cell / 2} r={Math.min(cell * 0.62, Math.sqrt((density * cell * cell) / Math.PI))} fill={color} />
          </pattern>
        ))}
        <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise" />
          {/* Kept small so fine detail survives under the magnifier. */}
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Wet ink soaking outward into paper fibres. */}
        <filter id="bleed-heavy" x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="4" result="fine" />
          <feDisplacementMap in="d" in2="fine" scale="3" />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id="bleed">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" />
          <feGaussianBlur stdDeviation="0.25" />
        </filter>
      </defs>
    </svg>
  );
}
