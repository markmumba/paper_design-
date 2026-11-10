"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { FlightAir } from "@/components/atmos/FlightAir";
import { SoundToggle } from "@/components/SoundToggle";
import dynamic from "next/dynamic";
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
    source: "After Manuscript B, Institut de France.",
    note: "L’uccello è strumento operante per legge matematica",
    noteEn: "“A bird is an instrument working according to mathematical law.” — Leonardo",
    body: "Leonardo watched birds and bats for years before drawing a frame a person could lie in and flap. Pedals and pulleys drove the wings. Human muscle was never strong enough, but his study of the wing was far ahead of its time.",
    steps: ["Spar, ribs and membrane are inked", "Pulleys beat the bat wings", "Enough beats, and it leaves the ground"],
    Machine: Ornithopter,
    Atmosphere: FlightAir,
    Explore: ExploreFlyingMachine,
  },
  {
    numeral: "II",
    title: "Aerial Screw",
    italian: "Vite aerea",
    year: "c. 1489",
    source: "After Manuscript B, folio 83v.",
    note: "Se questo strumento a vite sarà ben fatto… monterà in alto",
    noteEn: "“If this screw-shaped instrument is well made… it will rise up high.” — Leonardo",
    body: "A spiral of starched linen around a mast, turned by men pushing bars around a platform. Leonardo hoped it would grip the air the way a screw grips wood. It is often called an ancestor of the helicopter.",
    steps: ["Platform and mast go down first", "The crew turns the linen spiral", "It climbs, at least on paper"],
    Machine: AerialScrew,
    Explore: ExploreAerialScrew,
  },
  {
    numeral: "III",
    title: "Armoured Car",
    italian: "Carro coperto",
    year: "c. 1487",
    source: "After a sheet in the British Museum, London.",
    note: "Farò carri coperti, sicuri e inoffensibili",
    noteEn: "“I will make covered cars, safe and unassailable.” — Leonardo, letter to Ludovico Sforza",
    body: "A sloped wooden shell to turn aside enemy shot, ringed with light cannons. Inside, the crew turned cranks that drove the wheels through a train of gears.",
    steps: ["Shell, turret and cannons are inked", "Cranks roll it forward; the shell lifts away", "The cannons fire around the rim"],
    Machine: Tank,
    Explore: ExploreTank,
  },
  {
    numeral: "IV",
    title: "Giant Crossbow",
    italian: "Balestra gigante",
    year: "c. 1488–89",
    source: "After the Codex Atlanticus, folio 149r.",
    note: "L’arco si tende con la vite, e la noce lo lascia",
    noteEn: "“The bow is drawn by the screw, and the nut lets it go.” — caption written for this page",
    body: "Some twenty-four metres across, on six splayed wheels. A winch at the back hauls the string to a trigger. The bow arms were built in thin layers so they could bend without snapping. It may have been meant to frighten an enemy as much as to hit one.",
    steps: ["Carriage, wheels and the great bow", "The winch draws the string back", "Release"],
    Machine: Crossbow,
    Explore: ExploreCrossbow,
  },
  {
    numeral: "V",
    title: "Trebuchet",
    italian: "Trabocco",
    year: "c. 1485–90",
    source: "After studies in the Codex Atlanticus.",
    note: "Il peso scende, il braccio lancia",
    noteEn: "“The weight falls, the arm throws.” — caption written for this page",
    body: "A heavy box drops, a long arm whips over the top, and a sling flings the stone further still. Leonardo also sketched the curved paths that thrown stones and cannon shot follow through the air.",
    steps: ["Frame, arm and counterweight", "The weight drops and the arm swings", "The stone traces its arc"],
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
          Drawings on this page are new reinterpretations made for this study, after Leonardo da Vinci (1452–1519). Not to scale, and
          not engineering advice for building a siege engine.
        </p>
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
      <Finis />
    </main>
  );
}
