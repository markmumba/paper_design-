"use client";

import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { Fragment, memo, useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type RefObject } from "react";
import { FolioLive, rose, stepped } from "@/components/cues";
import { Loupe } from "@/components/Loupe";
import { sound } from "@/lib/sound";

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
  /** The last beat of each folio: would it have worked, and why. */
  verdict: Verdict;
  Machine: ComponentType<MachineProps>;
  /** Who wrote the Italian note: Leonardo (with where), or us. */
  quote: { by: "leonardo" | "ours"; ref?: string };
  /** What to call the drawing in the toggle (default: our reconstruction). */
  drawingLabel?: string;
  /** A public-domain scan of Leonardo's own page, for comparison. */
  scan: { src: string; caption: string; holder: string; href: string };
  /** Optional 3D exploration of the machine, loaded only when opened. */
  Explore?: ComponentType<{ onClose: () => void }>;
  /** Optional living environment drawn around the machine (wind, birds…). */
  Atmosphere?: ComponentType<{ p: MotionValue<number>; svgRef: RefObject<SVGSVGElement | null> }>;
};

export type Verdict = {
  question: string;
  answer: string;
  tone: "yes" | "no" | "maybe";
  why: string;
  /** What he got right, even if the machine failed. */
  right: string;
  /** A modern test or reconstruction, if there is one. */
  test?: string;
  testSource?: { label: string; href: string };
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

/**
 * Leonardo wrote right to left, every letter reversed. The note arrives in his
 * mirror hand and is deciphered one glyph at a time, from the right, the way
 * his pen moved. CSS transitions do the work, so scrolling costs nothing.
 */
function MirrorReveal({ text, p, at, className = "font-script text-3xl leading-snug text-sepia" }: { text: string; p: MotionValue<number>; at: number; className?: string }) {
  const [read, setRead] = useState(() => p.get() > at);
  useMotionValueEvent(p, "change", (v) => {
    if (v > at !== read) setRead(v > at);
  });
  const words = text.split(" ");
  const total = text.replace(/ /g, "").length;
  const stagger = Math.min(40, 1100 / total);
  let n = 0;
  return (
    <p aria-label={text} data-read={read || undefined} className={`mirror-reveal ${className}`}>
      {words.map((w, wi) => (
        <Fragment key={wi}>
          <span aria-hidden className="inline-block whitespace-nowrap">
            {[...w].map((ch, ci) => {
              const i = n++;
              // Right-most letter goes first.
              return (
                <span key={ci} style={{ "--d": `${Math.round((total - 1 - i) * stagger)}ms` } as CSSProperties}>
                  {ch}
                </span>
              );
            })}
          </span>
          {wi < words.length - 1 && " "}
        </Fragment>
      ))}
    </p>
  );
}

/** Says plainly whose words the Italian note is. */
function QuoteBadge({ quote }: { quote: ExhibitData["quote"] }) {
  return quote.by === "leonardo" ? (
    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-0.5 font-caps text-[0.68rem] tracking-widest text-paper">
      Leonardo’s words <span className="font-body text-xs normal-case tracking-normal opacity-80">· {quote.ref}</span>
    </p>
  ) : (
    <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-spot px-3 py-0.5 font-caps text-[0.68rem] tracking-widest text-spot">
      Our caption <span className="font-body text-xs normal-case tracking-normal opacity-80">· written for this page, not by Leonardo</span>
    </p>
  );
}

const STAMP: Record<Verdict["tone"], string> = {
  yes: "border-ink text-ink",
  no: "spot-layer border-spot text-spot",
  maybe: "border-rust text-rust",
};

/** Would it have worked? A plain answer, the reason, and what he got right anyway. */
function VerdictPanel({ verdict, stamp, stampOpacity }: { verdict: Verdict; stamp: MotionValue<number>; stampOpacity: MotionValue<number> }) {
  return (
    <section aria-label={verdict.question} className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="font-display text-2xl italic md:text-3xl">{verdict.question}</h3>
        <motion.p
          style={{ scale: stamp, opacity: stampOpacity, rotate: -4 }}
          className={`rounded-sm border-2 px-3 py-0.5 font-caps text-lg tracking-[0.2em] uppercase ${STAMP[verdict.tone]}`}
        >
          {verdict.answer}
        </motion.p>
      </div>
      <p className="mt-3 text-[1.02rem] leading-relaxed md:text-[1.08rem]">{verdict.why}</p>
      <dl className="mt-4 space-y-3 border-l border-sepia/40 pl-4 text-[0.95rem]">
        <div>
          <dt className="font-caps text-xs tracking-widest text-rust">What he got right</dt>
          <dd className="text-sepia">{verdict.right}</dd>
        </div>
        {verdict.test && (
        <div>
          <dt className="font-caps text-xs tracking-widest text-rust">Tested since</dt>
          <dd className="text-sepia">
            {verdict.test}
            {verdict.testSource && (
              <>
                {" "}
                <a
                  href={verdict.testSource.href}
                  target="_blank"
                  rel="noreferrer"
                  className="whitespace-nowrap text-faded italic underline decoration-dotted underline-offset-2 hover:text-ink"
                >
                  {verdict.testSource.label}
                </a>
              </>
            )}
          </dd>
        </div>
        )}
      </dl>
    </section>
  );
}

/** Leonardo's own page (a public-domain scan), shown in place of our drawing. */
function ScanView({ scan }: { scan: ExhibitData["scan"] }) {
  return (
    <figure className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 px-2 pt-12 pb-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote archival scan, shown as-is */}
      <img
        src={scan.src}
        alt={scan.caption}
        loading="lazy"
        className="max-h-[58svh] w-auto max-w-full rounded-sm shadow-[0_8px_30px_rgba(58,39,23,0.25)]"
      />
      <figcaption className="max-w-xl rounded-sm bg-paper/90 px-3 py-1 text-center text-sm text-sepia">
        <span className="italic">{scan.caption}</span>
        <br />
        <span className="text-faded">
          {scan.holder} · public domain ·{" "}
          <a href={scan.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
            view on Wikimedia Commons
          </a>
        </span>
      </figcaption>
    </figure>
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
  const [showScan, setShowScan] = useState(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.35 });
  const base = reduce ? scrollYProgress : smooth;
  // The drawing plays out over the first part of the folio. Then comes the
  // verdict: would it actually have worked? The tail lets the finished page
  // rest a moment before it lifts away for the next one.
  const p = useTransform(base, [0, 0.7], [0, 1]);
  const storyOpacity = useTransform(base, [0.71, 0.75], [1, 0]);
  const verdictOpacity = useTransform(base, [0.74, 0.78], [0, 1]);
  const verdictY = useTransform(base, [0.74, 0.79], [18, 0]);
  const stamp = useTransform(base, [0.76, 0.8], [1.5, 1]);
  const stampOpacity = useTransform(base, [0.76, 0.78], [0, 1]);
  const storyEvents = useTransform(storyOpacity, (o) => (o > 0.5 ? "auto" : "none"));
  const verdictEvents = useTransform(verdictOpacity, (o) => (o > 0.5 ? "auto" : "none"));

  // The folio lying across the middle of the screen is the open one. (A
  // share of the folio's own height can't be asked for: it is five screens
  // tall, so no more than a fifth of it is ever in view.) The page turns as
  // the seam between two folios passes mid-screen, in either direction.
  const inView = useInView(ref, { margin: "-50% 0px -50% 0px" });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  // Sound belongs only to the folio pinned on screen: one that is scrolled
  // past in a jump still runs its drawing through, unseen, and must stay quiet.
  const pinned = useCallback(() => {
    const v = scrollYProgress.get();
    return v > 0 && v < 1 && !exploring;
  }, [scrollYProgress, exploring]);
  const live = useCallback(() => pinned() && !showScan, [pinned, showScan]);
  // The quill: a scratch for every bit of line the scroll lays down. Only
  // forwards (un-drawing is not a pen), and only while there is ink going on.
  const penAt = useRef(p.get());
  useMotionValueEvent(p, "change", (v) => {
    const was = penAt.current;
    penAt.current = v;
    if (!reduce && v > was && v > 0.02 && v < 0.38 && stepped(was, v, 0.012) && live()) sound.scratch(0.4 + (v - was) * 60);
  });
  // The verdict is stamped: heard as the stamp comes to rest on the page.
  const stampAt = useRef(base.get());
  useMotionValueEvent(base, "change", (v) => {
    const was = stampAt.current;
    stampAt.current = v;
    if (rose(was, v, 0.795) && pinned()) sound.stamp();
  });

  // Text choreography, all keyed to the same scroll progress as the drawing.
  const headOpacity = useTransform(p, [0, 0.08], [0, 1]);
  const headY = useTransform(p, [0, 0.08], [24, 0]);
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
      className="relative h-[560vh]"
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
              <MirrorReveal text={data.italian} p={p} at={0.03} className="mt-1 font-display text-xl text-sepia italic" />
            </motion.div>

            {/* The story and the verdict share one place; scroll swaps them. */}
            <div className="grid">
              <motion.div className="[grid-area:1/1]" style={{ opacity: storyOpacity, pointerEvents: storyEvents }}>
            <div className="mt-5 hidden md:block">
              <MirrorReveal text={`“${data.note}”`} p={p} at={0.1} />
              <motion.div style={{ opacity: noteEnOpacity }}>
                <p className="mt-1 text-base text-faded italic">{data.noteEn}</p>
                <QuoteBadge quote={data.quote} />
              </motion.div>
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
            <p className="mt-3 text-sm text-faded italic">
              <span className="font-caps tracking-widest not-italic">Source · </span>
              {data.source}
            </p>
              </motion.div>
              <motion.div
                className="[grid-area:1/1]"
                style={{ opacity: verdictOpacity, y: reduce ? 0 : verdictY, pointerEvents: verdictEvents }}
              >
                <VerdictPanel verdict={data.verdict} stamp={stamp} stampOpacity={stampOpacity} />
              </motion.div>
            </div>
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
            {/* Provenance: this drawing is ours. One click shows Leonardo's own page. */}
            <div className="absolute -top-8 left-0 z-10 flex items-center gap-1 rounded-full border border-sepia/40 bg-paper/85 p-0.5 font-caps text-[0.7rem] tracking-widest">
              {(
                [
                  [false, data.drawingLabel ?? "Our reconstruction"],
                  [true, "Leonardo’s page"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={showScan === v}
                  onClick={() => setShowScan(v)}
                  className={`rounded-full px-3 py-1 transition-colors ${showScan === v ? "bg-ink text-paper" : "text-sepia hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {showScan && <ScanView scan={data.scan} />}
            {data.Atmosphere && !reduce && <data.Atmosphere p={p} svgRef={svgRef} />}
            <svg
              ref={svgRef}
              viewBox="0 0 600 480"
              style={{ opacity: showScan ? 0 : 1 }}
              className="relative h-full max-h-[78svh] w-full overflow-visible text-ink transition-opacity duration-500"
              role="img"
              aria-label={`Animated ink drawing of ${data.title}`}
            >
              <g id={`machine-${index}`}>
                <FolioLive.Provider value={live}>
                  <Machine p={p} />
                </FolioLive.Provider>
              </g>
              <Loupe svgRef={svgRef} target={`machine-${index}`} id={String(index)} />
            </svg>
            {!showScan && <p className="pointer-events-none absolute -top-6 right-0 hidden font-script text-lg text-faded md:block [@media(pointer:coarse)]:hidden">
              hover the drawing to look closer
            </p>}
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
