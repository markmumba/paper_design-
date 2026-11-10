"use client";

import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { memo, useEffect, useRef, useState, type ComponentType, type CSSProperties, type RefObject } from "react";
import { Loupe } from "@/components/Loupe";

export type MachineProps = { p: MotionValue<number> };

export type ExhibitData = {
  numeral: string;
  italian: string;
  title: string;
  year: string;
  source: string;
  note: string;
  noteEn: string;
  body: string;
  steps: [string, string, string];
  Machine: ComponentType<MachineProps>;
  /** Optional 3D exploration of the machine, loaded only when opened. */
  Explore?: ComponentType<{ onClose: () => void }>;
  /** Optional living environment drawn around the machine (wind, birds…). */
  Atmosphere?: ComponentType<{ p: MotionValue<number>; svgRef: RefObject<SVGSVGElement | null> }>;
};

// ── The spot plate: riso-style colour blocks printed behind each folio ────────
type Block = { box: CSSProperties; bar: CSSProperties; dots: CSSProperties };
const LAYOUTS: Block[] = [
  { box: { right: "4%", top: "9%", width: "26vw", height: "34vh" }, bar: { left: "4%", bottom: "15%" }, dots: { right: "6%", bottom: "9%" } },
  { box: { left: "36%", bottom: "6%", width: "22vw", height: "26vh" }, bar: { right: "7%", top: "16%" }, dots: { left: "5%", top: "8%" } },
  { box: { right: "9%", bottom: "9%", width: "30vw", height: "22vh" }, bar: { left: "6%", top: "12%" }, dots: { right: "5%", top: "7%" } },
  { box: { left: "42%", top: "5%", width: "17vw", height: "42vh" }, bar: { left: "5%", bottom: "12%" }, dots: { right: "8%", bottom: "8%" } },
  { box: { right: "3%", top: "28%", width: "24vw", height: "30vh" }, bar: { left: "38%", bottom: "7%" }, dots: { left: "5%", top: "7%" } },
];

function TwoDots({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 20" className={`spot-layer h-[0.9em] w-auto shrink-0 ${className}`} aria-hidden>
      <circle cx={10} cy={10} r={9} fill="var(--color-spot)" />
      <circle cx={24} cy={10} r={9} fill="var(--color-spot)" opacity={0.85} />
    </svg>
  );
}

/** Halftone colour blocks, a dotted bar and the two-dot mark, sliding in on their own plate. */
function SpotPlate({ index, p, base }: { index: number; p: MotionValue<number>; base: MotionValue<number> }) {
  const L = LAYOUTS[index % LAYOUTS.length];
  const inX = useTransform(p, [0.02, 0.14], [70, 0]);
  const inOpacity = useTransform(p, [0.02, 0.12], [0, 1]);
  const drift = useTransform(base, [0, 1], [40, -40]);
  const barX = useTransform(p, [0.1, 0.22], [-60, 0]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <motion.div className="spot-layer absolute" style={{ ...L.box, x: inX, y: drift, opacity: inOpacity }}>
        <div className="halftone-spot riso-grain absolute inset-0 opacity-70" />
        <div className="halftone-spot-dense riso-grain absolute top-[18%] left-[-14%] h-[46%] w-[58%] opacity-80" />
      </motion.div>
      <motion.div className="spot-layer absolute h-2.5 w-36" style={{ ...L.bar, x: barX, opacity: inOpacity }}>
        <div className="halftone-spot-dense h-full w-full" />
      </motion.div>
      <motion.div className="absolute" style={{ ...L.dots, opacity: inOpacity }}>
        <TwoDots className="h-10" />
      </motion.div>
    </div>
  );
}

export const Exhibit = memo(function Exhibit({
  data,
  index,
  onActive,
  pullUp,
}: {
  data: ExhibitData;
  index: number;
  onActive: (i: number) => void;
  /** Slide this folio up under the previous section so it is already pinned as that one ends. */
  pullUp?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [exploring, setExploring] = useState(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.35 });
  const base = reduce ? scrollYProgress : smooth;
  // The drawing plays out over most of the folio; the tail lets the finished
  // page rest a moment before it lifts away for the next one.
  const p = useTransform(base, [0, 0.88], [0, 1]);

  const inView = useInView(ref, { amount: 0.35 });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  // Text choreography, all keyed to the same scroll progress as the drawing.
  const headOpacity = useTransform(p, [0, 0.08], [0, 1]);
  const headY = useTransform(p, [0, 0.08], [24, 0]);
  const noteFlip = useTransform(p, [0.08, 0.24], [180, 0]);
  const noteEnOpacity = useTransform(p, [0.2, 0.28], [0, 1]);
  const bodyOpacity = useTransform(p, [0.14, 0.24], [0, 1]);
  const ruler = useTransform(base, [0, 1], [0, 1]);
  // Each sheet came off the press with its spot plate a little out of register.
  // Fixed per folio: animating it would repaint every red element on every frame.
  const misregister = { "--mis-x": `${[1.6, -1.2, 2.2, -0.8, 1.1][index % 5]}px`, "--mis-y": `${[-1, 1.4, -0.6, 1.8, -1.6][index % 5]}px` } as CSSProperties;
  // The finished folio lifts and fades as the next one slides up over it.
  const exitOpacity = useTransform(scrollYProgress, [0.92, 1], [1, 0.15]);
  const exitY = useTransform(scrollYProgress, [0.92, 1], [0, -40]);
  const stepOpacity = [
    useTransform(p, [0.02, 0.06, 0.32, 0.36], [0.35, 1, 1, 0.35]),
    useTransform(p, [0.32, 0.36, 0.66, 0.7], [0.35, 1, 1, 0.35]),
    useTransform(p, [0.66, 0.7], [0.35, 1]),
  ];

  const { Machine } = data;

  return (
    <section
      ref={ref}
      id={`folio-${index + 1}`}
      className="relative h-[460vh]"
      style={pullUp ? { marginTop: pullUp } : undefined}
      aria-labelledby={`title-${index}`}
    >
      <div className="sticky top-0 h-svh overflow-hidden" style={misregister}>
        <motion.div className="absolute inset-0 flex items-center" style={{ opacity: exitOpacity, y: reduce ? 0 : exitY }}>
        <SpotPlate index={index} p={p} base={base} />
        {/* Faint mirror-written lines behind everything, like a crowded notebook page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden font-script text-2xl leading-[2.4rem] text-faded/25 select-none"
        >
          <div className="mirror w-full px-6 pt-10">
            {Array.from({ length: 4 }, () => `${data.note} — ${data.italian}, ${data.year}. `).join("")}
          </div>
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl grid-rows-[auto_1fr] items-center gap-4 px-4 py-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-1 md:gap-10 md:px-10">
          <div className="max-w-lg">
            <motion.div style={{ opacity: headOpacity, y: headY }}>
              <p className="flex items-center gap-3 font-caps text-sm tracking-[0.3em] text-rust uppercase">
                <TwoDots />
                Folio {data.numeral} · {data.year}
              </p>
              <h2 id={`title-${index}`} className="mt-2 font-display text-[clamp(2.2rem,5vw,4rem)] leading-none">
                {data.title}
              </h2>
              <p className="mt-1 font-display text-xl text-sepia italic">{data.italian}</p>
            </motion.div>

            <div className="mt-5 hidden md:block" style={{ perspective: 700 }}>
              <motion.p
                className="origin-left font-script text-3xl leading-snug text-sepia"
                style={{ rotateY: noteFlip }}
              >
                “{data.note}”
              </motion.p>
              <motion.p className="mt-1 text-base text-faded italic" style={{ opacity: noteEnOpacity }}>
                {data.noteEn}
              </motion.p>
            </div>

            <motion.p className="mt-4 text-[1.05rem] md:text-lg" style={{ opacity: bodyOpacity }}>
              {data.body}
            </motion.p>

            <ol className="mt-5 hidden space-y-1 border-l border-sepia/40 pl-4 text-base md:block">
              {data.steps.map((s, i) => (
                <motion.li key={s} style={{ opacity: stepOpacity[i] }} className="flex gap-3">
                  <span className="font-caps text-rust">{["i", "ii", "iii"][i]}.</span>
                  {s}
                </motion.li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-faded italic">{data.source}</p>
            {data.Explore && (
              <motion.button
                type="button"
                onClick={() => setExploring(true)}
                style={{ opacity: bodyOpacity }}
                className="group mt-5 inline-flex items-center gap-3 rounded-full border border-ink/70 bg-paper/60 py-2 pr-5 pl-2 font-display text-lg italic transition-colors hover:bg-ink hover:text-paper"
              >
                <span className="spot-layer grid h-8 w-8 place-items-center rounded-full bg-spot text-paper not-italic">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                    <path d="M10 2l7 4v8l-7 4-7-4V6zM10 2v8m0 0l7-4M10 10l-7-4M10 10v8" />
                  </svg>
                </span>
                Esplora in tre dimensioni
                <span className="font-body text-sm not-italic opacity-70 group-hover:opacity-100">explore in 3D</span>
              </motion.button>
            )}
          </div>

          <div className="relative min-h-0 self-stretch md:self-center">
            {data.Atmosphere && !reduce && <data.Atmosphere p={p} svgRef={svgRef} />}
            <svg
              ref={svgRef}
              viewBox="0 0 600 480"
              className="relative h-full max-h-[78svh] w-full overflow-visible text-ink"
              role="img"
              aria-label={`Animated ink drawing of ${data.title}`}
            >
              <g id={`machine-${index}`}>
                <Machine p={p} />
              </g>
              <Loupe svgRef={svgRef} target={`machine-${index}`} id={String(index)} />
            </svg>
            <p className="pointer-events-none absolute -top-6 right-0 hidden font-script text-lg text-faded md:block [@media(pointer:coarse)]:hidden">
              hover the drawing to look closer
            </p>
          </div>
        </div>

        {/* Ink rule that fills as you move through the folio. */}
        <div className="absolute inset-x-4 bottom-5 md:inset-x-10">
          <svg viewBox="0 0 1000 10" preserveAspectRatio="none" className="h-2.5 w-full text-spot">
            <path d="M0 5H1000" stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <motion.path
              d="M0 5H1000"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: ruler }}
            />
          </svg>
        </div>
        </motion.div>
      </div>
      {exploring && data.Explore && <data.Explore onClose={() => setExploring(false)} />}
    </section>
  );
});
