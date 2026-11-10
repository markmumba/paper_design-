"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { SoundToggle } from "@/components/SoundToggle";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ComponentType } from "react";
import { sound } from "@/lib/sound";
import { Exhibit, type ExhibitData } from "@/components/Exhibit";
import { Hero } from "@/components/Hero";
import { InkFilters } from "@/components/ink";
import { AerialScrew } from "@/components/machines/AerialScrew";
import { Crossbow } from "@/components/machines/Crossbow";
import { Ornithopter } from "@/components/machines/Ornithopter";
import { Tank } from "@/components/machines/Tank";
import { Trebuchet } from "@/components/machines/Trebuchet";

// three.js only downloads when someone actually opens a 3D view.
function RoomLoader() {
  return (
    <div className="paper-veil fixed inset-0 z-[60] grid place-items-center text-sepia">
      <div className="flex flex-col items-center gap-4">
        <svg viewBox="-50 -50 100 100" className="h-20 w-20 animate-[gear-turn_3s_linear_infinite]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <path d={Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const p = (r: number, o: number) => `${(Math.cos(a + o) * r).toFixed(1)} ${(Math.sin(a + o) * r).toFixed(1)}`;
            return `${i ? "L" : "M"}${p(34, 0)}L${p(42, 0.08)}L${p(42, 0.34)}L${p(34, 0.42)}`;
          }).join("") + "Z"} />
          <circle r={11} />
          <circle r={4} />
        </svg>
        <p className="font-script text-3xl">preparing the workshop…</p>
      </div>
    </div>
  );
}
const room = (load: () => Promise<{ default: ComponentType<{ onClose: () => void }> }>) => dynamic(load, { ssr: false, loading: RoomLoader });
const ExploreFlyingMachine = room(() => import("@/components/explore/ExploreFlyingMachine"));
const ExploreAerialScrew = room(() => import("@/components/explore/rooms/AerialScrewRoom"));
const ExploreTank = room(() => import("@/components/explore/rooms/TankRoom"));
const ExploreCrossbow = room(() => import("@/components/explore/rooms/CrossbowRoom"));
const ExploreTrebuchet = room(() => import("@/components/explore/rooms/TrebuchetRoom"));

const EXHIBITS: ExhibitData[] = [
  {
    numeral: "I",
    title: "Flying Machine",
    italian: "Macchina volante",
    year: "c. 1488–90",
    source: "Our reconstruction, after Leonardo’s flying-machine studies in Manuscript B (Institut de France, Paris).",
    note: "L’uccello è strumento operante per legge matematica",
    noteEn: "“A bird is an instrument working according to mathematical law.”",
    quote: { by: "leonardo", ref: "Codex Atlanticus, f. 161r (traditional citation)" },
    scan: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Design_for_a_Flying_Machine.jpg?width=1200",
      caption: "Leonardo’s design for a flying machine, Manuscript B, c. 1488.",
      holder: "Institut de France, Paris",
      href: "https://commons.wikimedia.org/wiki/File:Design_for_a_Flying_Machine.jpg",
    },
    body: "Leonardo watched birds and bats for years before drawing a frame a person could lie in and flap. Pedals and pulleys drove the wings. Human muscle was never strong enough, but his study of the wing was far ahead of its time.",
    steps: ["Spar, ribs and membrane are inked", "Pulleys beat the bat wings", "Enough beats, and it leaves the ground"],
    verdict: {
      question: "Would it fly?",
      answer: "No",
      tone: "no",
      why: "A person can keep up roughly a fifth of a horsepower, about 150 watts. A bird puts up to a quarter of its weight into flight muscle; a man lying in a wooden frame with iron fittings has nothing like that to spare.",
      right: "That a wing works by pressing air down and back. His bird studies, collected in the Codex on the Flight of Birds (c. 1505), were the real breakthrough.",
      test: "In 2010 the Snowbird, a 42 kg ornithopter with a 32 m wingspan, flew 145 m in 19.3 s on one man's legs: the first human-powered flapping flight.",
      testSource: { label: "University of Toronto", href: "https://utoronto.ca/news/world-record-human-powered-flight-confirmed" },
    },
    Machine: Ornithopter,
    Explore: ExploreFlyingMachine,
  },
  {
    numeral: "II",
    title: "Aerial Screw",
    italian: "Vite aerea",
    year: "c. 1487–90",
    source: "Our reconstruction, after Manuscript B, f. 83v (Institut de France, Paris).",
    note: "Se questo strumento a vite sarà ben fatto… monterà in alto",
    noteEn: "“If this screw-shaped instrument is well made… it will rise up high.”",
    quote: { by: "leonardo", ref: "Manuscript B, f. 83v" },
    scan: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Leonardo_da_Vinci_-_19-540156.jpg?width=1200",
      caption: "The aerial screw and Leonardo’s note beside it, Manuscript B, f. 83v.",
      holder: "Institut de France, Paris (photo RMN)",
      href: "https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_19-540156.jpg",
    },
    body: "A spiral of starched linen around a mast, turned by men pushing bars around a platform. Leonardo hoped it would grip the air the way a screw grips wood. It is often called an ancestor of the helicopter.",
    steps: ["Platform and mast go down first", "The crew turns the linen spiral", "It climbs, at least on paper"],
    verdict: {
      question: "Would it lift?",
      answer: "Not with muscle",
      tone: "no",
      why: "Four men walking the bars could not make anywhere near the power to lift themselves, the deck and the mast. And with nothing to push against, the deck would spin the other way from the screw. Helicopters need a tail rotor for exactly this.",
      right: "The shape. A spinning helix does push air down and make lift.",
      test: "A 2025 Johns Hopkins simulation found his screw gave the same lift as an ordinary rotor for 58% of the power.",
      testSource: { label: "arXiv 2506.10223", href: "https://arxiv.org/abs/2506.10223" },
    },
    Machine: AerialScrew,
    Explore: ExploreAerialScrew,
  },
  {
    numeral: "III",
    title: "Armoured Car",
    italian: "Carro coperto",
    year: "c. 1485",
    source: "Our reconstruction, after the sheet of military machines in the British Museum (1860,0616.99).",
    note: "Farò carri coperti, sicuri e inoffensibili",
    noteEn: "“I will make covered cars, safe and unassailable.”",
    quote: { by: "leonardo", ref: "letter to Ludovico Sforza, Codex Atlanticus f. 1082r" },
    scan: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Leonardo_da_Vinci_-_1860,0616.99,_Studies_of_military_tank-like_machines.jpg?width=1400",
      caption: "Studies of military machines: a scythed chariot above, the armoured car below, opened up to show its works.",
      holder: "British Museum, London (1860,0616.99)",
      href: "https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_1860,0616.99,_Studies_of_military_tank-like_machines.jpg",
    },
    body: "A sloped wooden shell to turn aside enemy shot, ringed with light cannons. Inside, the crew turned cranks that drove the wheels through a train of gears.",
    steps: ["Shell, turret and cannons are inked", "Cranks roll it forward; the shell lifts away", "The cannons fire around the rim"],
    verdict: {
      question: "Would it roll?",
      answer: "Not as drawn",
      tone: "no",
      why: "The gears on his sheet turn the front wheels one way and the back wheels the other, so cranking it would only fight itself. Eight men pushing a heavy wooden shell over rough ground would also have crawled.",
      right: "The sloped armour, which turns shot aside instead of stopping it, and the idea of a crew driving a gun platform from inside it.",
      test: "Flip one pair of gears and it moves; Stanford’s reconstruction shows the fix. Some think he drew the error on purpose to guard the idea. Nobody knows.",
      testSource: { label: "Stanford reconstruction", href: "https://leonardodavinci.stanford.edu/projects/tank/Model.htm" },
    },
    Machine: Tank,
    Explore: ExploreTank,
  },
  {
    numeral: "IV",
    title: "Giant Crossbow",
    italian: "Balestra gigante",
    year: "c. 1488–89",
    source: "Our reconstruction, after the Codex Atlanticus, f. 53v (formerly f. 149a), Biblioteca Ambrosiana, Milan.",
    note: "L’arco si tende con la vite, e la noce lo lascia",
    noteEn: "“The bow is drawn by the screw, and the nut lets it go.”",
    quote: { by: "ours" },
    scan: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Codice_Atlantico_-_053v_detail.jpg?width=1400",
      caption: "The giant crossbow, with its winch and two trigger mechanisms, Codex Atlanticus f. 53v.",
      holder: "Biblioteca Ambrosiana, Milan",
      href: "https://commons.wikimedia.org/wiki/File:Codice_Atlantico_-_053v_detail.jpg",
    },
    body: "Some twenty-four metres across, on six splayed wheels. A winch at the back hauls the string to a trigger. The bow arms were built in thin layers so they could bend without snapping. It may have been meant to frighten an enemy as much as to hit one.",
    steps: ["Carriage, wheels and the great bow", "The winch draws the string back", "Release"],
    verdict: {
      question: "Would it shoot?",
      answer: "Not proven",
      tone: "maybe",
      why: "The bow is the problem. A bow some twenty-four metres across would have to bend and spring back without cracking, and the timber and glue of his day were not up to it.",
      right: "Laminating the arms from thin layers, the same idea as a modern composite bow.",
      test: "A large version built for the 2003 film Leonardo’s Dream Machines is reported to have cracked before it could be fired at full strength.",
      testSource: { label: "Manchester Historian", href: "https://manchesterhistorian.com/2011/leonardos-dream-machines/" },
    },
    Machine: Crossbow,
    Explore: ExploreCrossbow,
  },
  {
    numeral: "V",
    title: "Trebuchet",
    italian: "Trabocco",
    year: "1480s",
    source: "A composite, not one drawing: Leonardo sketched many throwing engines in the Codex Atlanticus, but no single sheet shows this counterweight trebuchet.",
    note: "Il peso scende, il braccio lancia",
    noteEn: "“The weight falls, the arm throws.”",
    quote: { by: "ours" },
    scan: {
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Da_Vinci_Catapult.jpg?width=1200",
      caption: "Not a trebuchet: Leonardo’s studies of spring-powered catapults, Codex Atlanticus f. 140a. Shown for comparison.",
      holder: "Biblioteca Ambrosiana, Milan",
      href: "https://commons.wikimedia.org/wiki/File:Da_Vinci_Catapult.jpg",
    },
    body: "A heavy box drops, a long arm whips over the top, and a sling flings the stone further still. Leonardo also sketched the curved paths that thrown stones and cannon shot follow through the air.",
    steps: ["Frame, arm and counterweight", "The weight drops and the arm swings", "The stone traces its arc"],
    verdict: {
      question: "Would it throw?",
      answer: "Yes",
      tone: "yes",
      why: "Counterweight trebuchets had been battering walls since the 1100s. A falling weight is a simple, reliable store of energy, and the sling adds a second, longer arm for free.",
      right: "That a thrown stone follows a curved path you can reason about. He sketched those arcs again and again.",
      test: "By Leonardo’s time cannon were taking over. The trebuchet worked, but its age was ending.",
    },
    Machine: Trebuchet,
    Explore: ExploreTrebuchet,
  },
];

// Folio I slides up under the hero so it is already pinned and drawing while
// you fall through the orrery. The hero is 230vh tall (130vh of pinned scroll);
// pulling Folio I up by 150svh pins it at ~60% of the hero's dive.
const HERO_OVERLAP = "-150svh";

// Which folio is in view lives in a tiny store, not in Museum's state: setting
// state here used to re-render every exhibit (thousands of ink strokes) at each
// section boundary, a 100-180 ms freeze. Only the index subscribes to it.
let activeFolio = -1;
const activeListeners = new Set<() => void>();
const activeStore = {
  subscribe: (l: () => void) => {
    activeListeners.add(l);
    return () => activeListeners.delete(l);
  },
  get: () => activeFolio,
  set: (i: number) => {
    if (i === activeFolio) return;
    activeFolio = i;
    activeListeners.forEach((l) => l());
  },
};

function Index() {
  const active = useSyncExternalStore(activeStore.subscribe, activeStore.get, () => -1);
  return (
    <nav aria-label="Folios" className="fixed top-1/2 left-5 z-40 hidden -translate-y-1/2 2xl:block">
      <ol className="space-y-3">
        {EXHIBITS.map((e, i) => (
          <li key={e.numeral}>
            <a
              href={`#folio-${i + 1}`}
              className={`relative flex items-center gap-3 font-caps text-sm transition-colors duration-500 ${
                active === i ? "text-rust" : "text-faded hover:text-sepia"
              }`}
              aria-current={active === i ? "true" : undefined}
            >
              <span className="w-7 text-right">{e.numeral}</span>
              <span className="relative h-px w-8 bg-current/30">
                {active === i && (
                  <motion.span layoutId="index-ink" className="absolute inset-y-[-0.5px] left-0 w-full bg-rust" />
                )}
              </span>
              <span
                className={`text-xs tracking-widest uppercase transition-opacity duration-500 ${
                  active === i ? "opacity-100" : "opacity-0"
                }`}
              >
                {e.italian}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** How to tell Leonardo's work from ours, and where every source lives. */
function Sources() {
  const key: [string, string, string][] = [
    ["Leonardo’s words", "A quotation from his notebooks or letters, with the manuscript it comes from.", "bg-ink text-paper"],
    ["Our caption", "Italian we wrote in his manner to describe our drawing. Not his words.", "border border-spot text-spot"],
    ["Our reconstruction", "Every animated drawing and 3D model is new, made for this site after his sheets.", "border border-sepia/50 text-sepia"],
    ["Leonardo’s page", "A public-domain photograph of his actual sheet, from the institution that holds it.", "border border-ink text-ink"],
  ];
  return (
    <section id="fonti" aria-labelledby="fonti-title" className="mx-auto max-w-4xl px-5 pt-24 pb-10">
      <p className="font-caps text-sm tracking-[0.3em] text-rust uppercase">Fonti · Sources</p>
      <h2 id="fonti-title" className="mt-2 font-display text-4xl">How to read this codex</h2>
      <p className="mt-3 max-w-2xl text-lg">
        This site mixes Leonardo’s own words and pages with drawings, captions and simulations made for it. This key shows which is
        which.
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {key.map(([term, def, cls]) => (
          <div key={term} className="flex flex-col gap-1.5">
            <dt>
              <span className={`inline-block rounded-full px-3 py-0.5 font-caps text-xs tracking-widest ${cls}`}>{term}</span>
            </dt>
            <dd className="text-base text-sepia">{def}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-12 font-display text-2xl italic">Leonardo’s sheets behind each folio</h3>
      <ol className="mt-4 space-y-4">
        {EXHIBITS.map((e) => (
          <li key={e.numeral} className="grid gap-1 border-t border-sepia/30 pt-3 sm:grid-cols-[6rem_1fr]">
            <span className="font-caps text-sm tracking-widest text-rust">Folio {e.numeral}</span>
            <div>
              <p className="font-display text-lg">
                {e.title} <span className="text-sepia italic">· {e.italian}</span>
              </p>
              <p className="text-base">{e.source}</p>
              <p className="text-sm text-faded">
                Original sheet: {e.scan.holder} ·{" "}
                <a href={e.scan.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
                  public-domain image on Wikimedia Commons
                </a>
              </p>
              <p className="mt-1 text-sm text-faded">
                Quote: {e.quote.by === "leonardo" ? `Leonardo, ${e.quote.ref}.` : "our caption, written for this page."}
              </p>
              {e.verdict.testSource && (
                <p className="text-sm text-faded">
                  “{e.verdict.question}” evidence:{" "}
                  <a href={e.verdict.testSource.href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-ink">
                    {e.verdict.testSource.label}
                  </a>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <h3 className="mt-12 font-display text-2xl italic">What else is ours</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base text-sepia">
        <li>The tiny mirror-written notes in the drawings: each carries a plain credit, whether Leonardo’s (Folios II and III) or ours.</li>
        <li>The 3D models, their part notes and the action scenes are reconstructions. The physics is real, but its numbers (masses, forces, speeds) are our estimates, not Leonardo’s figures.</li>
        <li>The hidden notes revealed by the candle in the opening are Leonardo’s own sayings; the orrery that frames them is invented.</li>
        <li>Folio numbers follow the institutions’ catalogues. The Codex Atlanticus has been renumbered, so older books give different folios (f. 53v was once f. 149a).</li>
      </ul>
    </section>
  );
}

function Finis() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  return (
    <footer className="flex min-h-[80svh] flex-col items-center justify-center px-4 text-center">
      <div ref={ref}>
        <p className="font-display text-6xl italic">Finis</p>
        <svg viewBox="0 0 320 60" className="mx-auto mt-3 w-72 text-sepia" aria-hidden>
          <motion.path
            d="M10 38C60 8 90 52 130 30S190 6 205 30 250 52 310 22M120 46C150 40 180 44 205 50"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={seen ? { pathLength: 1 } : undefined}
            transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1] }}
          />
        </svg>
        <p className="mx-auto mt-6 max-w-md text-base text-faded italic">
          Drawings on this page are new reinterpretations made for this study, after Leonardo da Vinci (1452–1519).{" "}
          <a href="#fonti" className="underline decoration-dotted underline-offset-2 not-italic hover:text-ink">
            See the sources
          </a>
          . Not to scale, and not engineering advice for building a siege engine.
        </p>
        <Link
          href="/anatomia"
          className="group mx-auto mt-10 flex max-w-md items-center gap-4 rounded-sm border border-sepia/40 bg-paper/60 px-5 py-4 text-left transition-colors hover:border-ink"
        >
          <span className="font-display text-4xl text-rust italic">→</span>
          <span>
            <span className="block font-caps text-xs tracking-[0.3em] text-rust uppercase">Anatomia</span>
            <span className="block font-display text-2xl leading-tight">The body as a machine</span>
            <span className="block text-sm text-faded">Measure the Vitruvian Man, and open Leonardo’s anatomical sheets.</span>
          </span>
        </Link>
        <a href="#top" className="mt-8 inline-block font-script text-2xl text-rust">
          torna all’inizio · back to the start
        </a>
      </div>
    </footer>
  );
}

export function Museum() {
  const last = useRef(-1);
  // Turning to a new folio sounds like turning a page.
  const onActive = useCallback((i: number) => {
    if (i !== last.current) sound.pageFlip();
    last.current = i;
    activeStore.set(i);
  }, []);
  // When sound is switched on: strike the candle if we're in the hero, else turn a page.
  const onEnable = useCallback(() => {
    const hero = document.getElementById("hero");
    if (hero && window.scrollY < hero.offsetHeight * 0.5) sound.strike();
    else sound.pageFlip();
  }, []);
  return (
    <main id="top">
      <SoundToggle onEnable={onEnable} />
      <InkFilters />
      <Hero />
      <Index />
      {EXHIBITS.map((e, i) => (
        <Exhibit key={e.numeral} data={e} index={i} onActive={onActive} pullUp={i === 0 ? HERO_OVERLAP : undefined} />
      ))}
      <Sources />
      <Finis />
    </main>
  );
}
