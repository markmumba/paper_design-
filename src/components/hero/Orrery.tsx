"use client";

import { useMotionValue } from "motion/react";
import type { ComponentType } from "react";
import type { MachineProps } from "@/components/Exhibit";
import { AerialScrew } from "@/components/machines/AerialScrew";
import { Crossbow } from "@/components/machines/Crossbow";
import { Ornithopter } from "@/components/machines/Ornithopter";
import { Tank } from "@/components/machines/Tank";
import { Trebuchet } from "@/components/machines/Trebuchet";
import { circle, gear, line, poly, spokes } from "@/lib/geo";
import { radialTicks, rings } from "@/lib/detail";

/*
 * The Orrery of Machines: an impossible clockwork that Leonardo never drew.
 * Concentric rings sit at different depths so the whole thing parallaxes in
 * 3D as the candle (your cursor) moves. Every ring turns at its own rate on
 * the GPU (CSS transforms on composited layers), so the heavy ink detail is
 * rasterised once and never redrawn.
 */

const C = 400;

/** A ring gear with teeth pointing inwards. */
function ringGear(r: number, n: number, depth: number) {
  const step = (Math.PI * 2) / n;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const at = (ang: number, rad: number): [number, number] => [C + Math.cos(ang) * rad, C + Math.sin(ang) * rad];
    pts.push(at(a, r), at(a + step * 0.18, r - depth), at(a + step * 0.48, r - depth), at(a + step * 0.66, r));
  }
  return poly(pts, true);
}

// ── Outer band: a dial engraved with hours, minutes and Leonardo's own words ──
const BAND_TICKS =
  radialTicks(C, C, 362, 370, 180) + radialTicks(C, C, 356, 370, 36) + radialTicks(C, C, 342, 350, 72, Math.PI / 72);
const BAND = rings(C, C, [392, 388, 370, 356, 342, 338]);
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const MOTTO =
  "Ogni nostra cognizione principia da’ sentimenti · Chi poco pensa, molto erra · La pittura è una poesia che si vede e non si sente · ";

export function BandLayer() {
  return (
    <svg viewBox="0 0 800 800" className="h-full w-full text-ink" aria-hidden>
      <defs>
        <path id="motto-path" d={`M${C} ${C - 380}a380 380 0 1 1 -0.01 0`} />
      </defs>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d={BAND} strokeWidth={0.8} />
        <path d={BAND_TICKS} strokeWidth={0.6} />
      </g>
      <text className="fill-sepia" style={{ fontFamily: "var(--font-aurore)", fontSize: 13, letterSpacing: "0.04em" }}>
        <textPath href="#motto-path">{MOTTO + MOTTO}</textPath>
      </text>
      {NUMERALS.map((n, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        // Rounded so server and client agree on the exact attribute text.
        const x = Math.round((C + Math.cos(a) * 349) * 100) / 100;
        const y = Math.round((C + Math.sin(a) * 349) * 100) / 100;
        return (
          <text
            key={n}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${(i / 12) * 360} ${x} ${y})`}
            className="fill-ink"
            style={{ fontFamily: "var(--font-fell-sc)", fontSize: 11 }}
          >
            {n}
          </text>
        );
      })}
    </svg>
  );
}

// ── Ring gear and the planet gears that roll around inside it ────────────────
const RING = ringGear(326, 140, 9) + rings(C, C, [334, 330]);
const PLANET_R = 44;
const PLANET_ORBIT = 326 - 9 - PLANET_R + 4;

export function GearLayer() {
  return (
    <svg viewBox="0 0 800 800" className="h-full w-full text-ink" aria-hidden>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d={RING} strokeWidth={0.9} />
        <path d={radialTicks(C, C, 334, 338, 140)} strokeWidth={0.4} />
      </g>
    </svg>
  );
}

/** Planet gears sit on a carrier that turns; each also spins on its own axle. */
export function PlanetLayer() {
  return (
    <div className="absolute inset-0 animate-[orrery-spin_90s_linear_infinite]">
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const x = 50 + (Math.cos(a) * PLANET_ORBIT * 100) / 800;
        const y = 50 + (Math.sin(a) * PLANET_ORBIT * 100) / 800;
        const s = ((PLANET_R + 6) * 2 * 100) / 800;
        return (
          <div
            key={k}
            className="absolute animate-[orrery-spin-rev_14s_linear_infinite]"
            style={{ left: `${(x - s / 2).toFixed(3)}%`, top: `${(y - s / 2).toFixed(3)}%`, width: `${s.toFixed(3)}%`, height: `${s.toFixed(3)}%` }}
          >
            <svg viewBox="-50 -50 100 100" className="h-full w-full text-ink" aria-hidden>
              <g fill="none" stroke="currentColor" strokeLinecap="round">
                <path d={gear(0, 0, PLANET_R, 22, 6)} strokeWidth={1.1} />
                <path d={rings(0, 0, [PLANET_R - 10, 9, 4]) + spokes(0, 0, PLANET_R - 10, 5) + radialTicks(0, 0, 9, PLANET_R - 10, 15, 0.2)} strokeWidth={0.45} />
              </g>
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// ── Medallions: the five exhibits orbiting as charms; click one to jump there ──
const MACHINES: { Machine: ComponentType<MachineProps>; numeral: string; name: string }[] = [
  { Machine: Ornithopter, numeral: "I", name: "Macchina volante" },
  { Machine: AerialScrew, numeral: "II", name: "Vite aerea" },
  { Machine: Tank, numeral: "III", name: "Carro coperto" },
  { Machine: Crossbow, numeral: "IV", name: "Balestra gigante" },
  { Machine: Trebuchet, numeral: "V", name: "Trabocco" },
];
const MED_ORBIT = 208;
const MED_R = 72;

export function MedallionLayer() {
  // Drawn up to the main strokes only: the hairline fibres and notes are far
  // too fine to see at charm size and would only cost paint time.
  const still = useMotionValue(0.26);
  return (
    <div className="absolute inset-0 animate-[orrery-spin_160s_linear_infinite]">
      {/* The carrier arm the charms hang from. */}
      <svg viewBox="0 0 800 800" className="absolute inset-0 h-full w-full text-sepia" aria-hidden>
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d={rings(C, C, [MED_ORBIT + 1, MED_ORBIT - 1])} strokeWidth={0.5} strokeDasharray="1 5" />
          {MACHINES.map((_, k) => {
            const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
            return <path key={k} d={line(C + Math.cos(a) * 128, C + Math.sin(a) * 128, C + Math.cos(a) * (MED_ORBIT - MED_R), C + Math.sin(a) * (MED_ORBIT - MED_R))} strokeWidth={1.4} />;
          })}
        </g>
      </svg>
      {MACHINES.map(({ Machine, numeral, name }, k) => {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + (Math.cos(a) * MED_ORBIT * 100) / 800;
        const y = 50 + (Math.sin(a) * MED_ORBIT * 100) / 800;
        const s = (MED_R * 2 * 100) / 800;
        return (
          <div key={numeral} className="absolute" style={{ left: `${(x - s / 2).toFixed(3)}%`, top: `${(y - s / 2).toFixed(3)}%`, width: `${s.toFixed(3)}%`, height: `${s.toFixed(3)}%` }}>
            {/* Counter-rotate so each machine stays upright as the carrier turns. */}
            <a
              href={`#folio-${k + 1}`}
              aria-label={`Folio ${numeral}: ${name}`}
              className="group pointer-events-auto block h-full w-full animate-[orrery-spin-rev_160s_linear_infinite]"
            >
              <div className="relative h-full w-full rounded-full transition-transform duration-500 group-hover:scale-110">
                <svg viewBox="-80 -80 160 160" className="absolute inset-0 h-full w-full overflow-visible text-ink" aria-hidden>
                  <circle r={MED_R - 2} style={{ fill: "var(--color-paper)" }} />
                  <g fill="none" stroke="currentColor">
                    <path d={rings(0, 0, [MED_R - 2, MED_R - 6, MED_R + 3])} strokeWidth={0.9} />
                    <path d={radialTicks(0, 0, MED_R - 2, MED_R + 3, 60)} strokeWidth={0.4} />
                  </g>
                  <text y={MED_R + 16} textAnchor="middle" className="fill-rust" style={{ fontFamily: "var(--font-fell-sc)", fontSize: 12 }}>
                    {numeral}
                  </text>
                </svg>
                <div className="absolute inset-[12%] overflow-hidden rounded-full">
                  <svg viewBox="0 0 600 480" className="h-full w-full text-ink" aria-hidden preserveAspectRatio="xMidYMid meet">
                    <g>
                      <Machine p={still} />
                    </g>
                  </svg>
                </div>
                <span className="pointer-events-none absolute top-full left-1/2 mt-5 -translate-x-1/2 font-script text-lg whitespace-nowrap text-rust opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  {name}
                </span>
              </div>
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ── The heart: Vitruvian construction inside an armillary of tilted rings ─────
const HEART =
  circle(C, C, 128) +
  `M${C - 104} ${C - 96}h208v208h-208Z` +
  line(C - 104, C - 96, C + 104, C + 112) +
  line(C + 104, C - 96, C - 104, C + 112) +
  line(C, C - 150, C, C + 150) +
  line(C - 150, C, C + 150, C) +
  radialTicks(C, C, 128, 134, 48);

export function HeartLayer() {
  return (
    <div className="absolute inset-0 [transform-style:preserve-3d]">
      <svg viewBox="0 0 800 800" className="absolute inset-0 h-full w-full text-ink" aria-hidden>
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d={HEART} strokeWidth={0.9} />
          <path d={circle(C, C, 3) + circle(C, C, 9)} strokeWidth={0.8} />
        </g>
      </svg>
      {/* Armillary hoops: ellipses spinning about their own axes, faking a 3D sphere. */}
      {[0, 60, 120].map((tilt, i) => (
        <div key={tilt} className="absolute inset-[30%]" style={{ transform: `rotate(${tilt}deg)`, transformStyle: "preserve-3d" }}>
          <div className="h-full w-full" style={{ animation: `armillary ${11 + i * 4}s linear ${-i * 3}s infinite`, transformStyle: "preserve-3d" }}>
            <svg viewBox="0 0 320 320" className="h-full w-full text-sepia" aria-hidden>
              <ellipse cx={160} cy={160} rx={150} ry={150} fill="none" stroke="currentColor" strokeWidth={1.2} />
              <ellipse cx={160} cy={160} rx={146} ry={146} fill="none" stroke="currentColor" strokeWidth={0.4} strokeDasharray="2 6" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
