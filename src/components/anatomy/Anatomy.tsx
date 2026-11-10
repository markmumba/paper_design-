"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Exhibit } from "@/components/Exhibit";
import { InkFilters } from "@/components/ink";
import { CONTEXT_SOURCES, RULES, SHEET, STUDIES, type Source, type Study } from "./data";
import { FOLIOS } from "./folios";

function SourceLinks({ sources, label = "Sources" }: { sources: Source[]; label?: string }) {
  return (
    <p className="mt-4 text-sm text-faded">
      {label}:{" "}
      {sources.map((s, i) => (
        <span key={s.href}>
          {i > 0 && " · "}
          <a href={s.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
            {s.label}
          </a>
        </span>
      ))}
    </p>
  );
}

function StudyText({ study }: { study: Study }) {
  return (
    <div>
      <p className="font-caps text-sm tracking-[0.25em] text-rust uppercase">
        {study.italian} · {study.date}
      </p>
      <h3 className="mt-1 font-display text-3xl">{study.title}</h3>
      <p className="mt-3 text-[1.05rem] leading-relaxed">{study.shows}</p>
      <dl className="mt-4 space-y-3 border-l border-sepia/40 pl-4">
        <div>
          <dt className="font-caps text-xs tracking-widest text-rust">What he got right</dt>
          <dd className="text-sepia">{study.right}</dd>
        </div>
        {study.wrong && (
          <div>
            <dt className="font-caps text-xs tracking-widest text-rust">What he got wrong</dt>
            <dd className="text-sepia">{study.wrong}</dd>
          </div>
        )}
      </dl>
      <SourceLinks sources={study.sources} />
    </div>
  );
}

/** Leonardo's own sheet, with Vitruvius' rules drawn over it one at a time. */
function MeasureTheSheet() {
  const reduce = useReducedMotion();
  const [ruleId, setRuleId] = useState(RULES[0].id);
  const rule = RULES.find((r) => r.id === ruleId) ?? RULES[0];
  const draw = (i: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          exit: { opacity: 0, transition: { duration: 0.2 } },
          transition: { duration: 1.1, delay: i * 0.25, ease: [0.65, 0, 0.35, 1] as const },
        };
  return (
    <section id="misura" className="mx-auto mt-10 grid max-w-7xl gap-10 px-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:px-10" aria-label="Measure the real Vitruvian Man">
      <div className="md:pt-2">
        <p className="font-caps text-sm tracking-[0.3em] text-rust uppercase">Misuralo · Measure the real one</p>
        <h2 className="mt-2 font-display text-[clamp(2rem,4vw,3.2rem)] leading-none">His sheet, under the ruler</h2>
        <p className="mt-4 text-base text-faded italic">
          This is Leonardo’s own drawing, not ours. Choose a rule and it is drawn over his sheet, so you can check it against his figure.
        </p>
        <ol className="mt-5 space-y-1">
          {RULES.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={r.id === ruleId}
                onClick={() => setRuleId(r.id)}
                className={`flex w-full gap-3 rounded-sm py-1.5 text-left text-lg transition-colors ${r.id === ruleId ? "text-ink" : "text-faded hover:text-sepia"}`}
              >
                <span className="w-6 font-caps text-rust">{["i", "ii", "iii", "iv", "v"][i]}.</span>
                {r.title}
              </button>
            </li>
          ))}
        </ol>
        <AnimatePresence mode="wait">
          <motion.div key={rule.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 border-l border-sepia/40 pl-4">
            <p className="text-[1.05rem] leading-relaxed">{rule.text}</p>
            <p className={`mt-3 inline-flex rounded-full px-3 py-0.5 font-caps text-[0.68rem] tracking-widest ${rule.by.startsWith("Leonardo") ? "bg-ink text-paper" : "border border-sepia/50 text-sepia"}`}>
              {rule.by}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <figure className="sticky top-0 z-10 order-first -mx-4 bg-paper/95 px-4 pt-2 pb-2 md:order-none md:top-6 md:mx-0 md:self-start md:bg-transparent md:p-0">
        <div className="relative mx-auto w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote archival scan, shown as-is */}
          <img
            src={SHEET.src}
            alt="Leonardo da Vinci, the Vitruvian Man: a man in two overlapping poses inside a circle and a square, with his notes above and below."
            width={SHEET.w}
            height={SHEET.h}
            loading="lazy"
            className="block max-h-[46svh] w-auto max-w-full rounded-sm shadow-[0_8px_30px_rgba(58,39,23,0.25)] md:max-h-[84svh]"
          />
          <svg viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} className="pointer-events-none absolute inset-0 h-full w-full" fill="none" aria-hidden>
            <AnimatePresence>
              <motion.g key={rule.id} className="spot-layer" stroke="var(--color-spot)" strokeWidth={3.2} strokeLinecap="round">
                {rule.paths.map((d, i) => (
                  <motion.path key={i} d={d} {...draw(i)} />
                ))}
                {rule.dots?.map(([x, y], i) => (
                  <motion.circle
                    key={`d${i}`}
                    cx={x}
                    cy={y}
                    r={9}
                    fill="var(--color-spot)"
                    stroke="none"
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.08, type: "spring", stiffness: 300, damping: 18 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                ))}
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>
        <figcaption className="mt-2 text-center text-xs text-sepia md:mt-3 md:text-sm">
          <span className="italic">The Vitruvian Man, c. 1490. Pen and ink on paper, 34.4 × 25.5 cm.</span>
          <br />
          <span className="text-faded">
            {SHEET.holder} · public domain ·{" "}
            <a href={SHEET.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
              view on Wikimedia Commons
            </a>
          </span>
          <span className="mt-1 block text-faded">The red lines are ours, drawn over his.</span>
        </figcaption>
      </figure>
    </section>
  );
}

/** Two more of his sheets, shown as they are. */
function MoreSheets() {
  const more = STUDIES.filter((s) => s.id === "shoulder" || s.id === "womb");
  return (
    <section className="mx-auto mt-28 max-w-7xl px-4 md:px-10" aria-label="More of his anatomical sheets">
      <p className="font-caps text-sm tracking-[0.3em] text-rust uppercase">Altri fogli · More of his sheets</p>
      <div className="mt-8 grid gap-14 md:grid-cols-2">
        {more.map((s) => (
          <article key={s.id} className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote archival scan, shown as-is */}
              <img src={s.scan.src} alt={s.scan.caption} loading="lazy" className="w-full rounded-sm shadow-[0_8px_30px_rgba(58,39,23,0.25)]" />
              <figcaption className="mt-2 text-xs text-faded">
                {s.scan.holder} · public domain ·{" "}
                <a href={s.scan.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
                  Commons
                </a>
              </figcaption>
            </figure>
            <StudyText study={s} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function Anatomy() {
  const onActive = useCallback(() => {}, []);
  const allSources = [...STUDIES.flatMap((s) => s.sources), ...CONTEXT_SOURCES].filter((s, i, a) => a.findIndex((x) => x.href === s.href) === i);
  return (
    <main id="top">
      <InkFilters />
      <div className="mx-auto max-w-7xl px-4 pt-8 md:px-10">
        <nav className="flex items-center justify-between">
          <Link href="/" className="font-script text-xl text-sepia hover:text-ink">
            ← Codex of Machines
          </Link>
          <a href="#fonti" className="font-caps text-xs tracking-widest text-faded hover:text-ink">
            Fonti · sources
          </a>
        </nav>

        <header className="flex min-h-[80svh] max-w-3xl flex-col justify-center py-16">
          <p className="font-caps text-sm tracking-[0.3em] text-rust uppercase">Anatomia</p>
          <h1 className="mt-2 font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-none">The body as a machine</h1>
          <p className="mt-2 font-script text-2xl text-sepia">Le proporzioni del corpo umano</p>
          <p className="mt-6 text-lg leading-relaxed md:text-xl">
            Leonardo studied people the way he studied his machines: by taking them apart. Around 1490 he measured the
            body against a Roman architect’s rules. Twenty years later, in the winter of 1510–11, working with the Pavia
            anatomist Marcantonio della Torre, he may have dissected as many as twenty bodies, drawing what he found
            more clearly than anyone had before.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-sepia">
            He meant to publish a treatise. Then war came to Milan, della Torre died of the plague in 1511, and the
            drawings went unseen for centuries. About 150 of his anatomical sheets survive, most of them now in the
            Royal Collection at Windsor.
          </p>
          <p className="mt-8 font-script text-xl text-faded">scroll, and the folios draw themselves ↓</p>
        </header>
      </div>

      {FOLIOS.map((f, i) => (
        <Exhibit key={f.numeral} data={f} index={i} onActive={onActive} />
      ))}

      <MeasureTheSheet />
      <MoreSheets />

      <section id="fonti" className="mx-auto mt-28 max-w-3xl border-t border-sepia/30 px-4 pt-8 md:px-0">
        <p className="font-caps text-sm tracking-[0.3em] text-rust uppercase">Fonti · Sources</p>
        <p className="mt-3 text-base text-sepia">
          The ink drawings in the folios are our redrawings, made for this page after Leonardo’s sheets; each folio’s
          toggle shows his real one. The Italian captions are ours, written in his manner, not his words. The
          photographs of his sheets come from the institutions that hold them, shared as public domain on Wikimedia
          Commons. The red measurements are ours.
        </p>
        <SourceLinks sources={allSources} />
      </section>

      <footer className="mt-20 pb-24 text-center">
        <Link href="/" className="font-script text-2xl text-rust">
          torna alle macchine · back to the machines
        </Link>
      </footer>
    </main>
  );
}
