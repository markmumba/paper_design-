"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { BandLayer, GearLayer, HeartLayer, MedallionLayer, PlanetLayer } from "@/components/hero/Orrery";
import { Dust, InkSplat, type Light, type Splat } from "@/components/hero/Candle";
import { sound } from "@/lib/sound";

/*
 * The hero is Leonardo's desk at night.
 *
 *  - Your cursor is a candle flame. Its light is the only light in the room:
 *    a flickering pool that lags behind your hand like a real flame does.
 *  - Under that light, invisible ink appears: mirror-written notes and water
 *    studies that are on the page but only show where the warmth reaches.
 *  - In the middle floats the Orrery of Machines, an impossible clockwork in
 *    five depths that tilts with the light. The five exhibits hang from it as
 *    charms; touch one to travel to its folio.
 *  - Click the desk and a drop of ink falls, blooms into the fibres and dries.
 *  - Scroll, and you fall through the heart of the orrery into the codex,
 *    while dawn lifts the darkness.
 */

// Invisible-ink water studies: Leonardo drew water as spiralling vortices.
function vortex(cx: number, cy: number, r: number, turns: number, seed: number) {
  let d = "";
  const steps = Math.round(turns * 60);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2 + seed;
    const rr = r * (1 - t) * (1 + 0.06 * Math.sin(a * 3 + seed));
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr * 0.8).toFixed(1)}`;
  }
  return d;
}
const VORTICES = [
  vortex(220, 230, 130, 4.5, 0.4) + vortex(330, 300, 70, 3, 2.1) + vortex(150, 350, 55, 2.5, 4),
  vortex(1380, 760, 150, 5, 1.2) + vortex(1260, 840, 80, 3.2, 3.3) + vortex(1470, 650, 60, 2.6, 5.1),
  vortex(1340, 190, 90, 3.5, 2.6) + vortex(260, 820, 100, 4, 0.9),
];
const EYE =
  "M1180 470c40 -38 110 -38 150 0c-40 38 -110 38 -150 0Z" +
  "M1255 470m-24 0a24 24 0 1 0 48 0a24 24 0 1 0 -48 0M1255 470m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" +
  Array.from({ length: 9 }, (_, i) => {
    const a = (-0.5 + i / 8) * 1.1;
    return `M1330 470L${(1330 + Math.cos(a) * 160).toFixed(0)} ${(470 + Math.sin(a) * 160).toFixed(0)}`;
  }).join("");
const SECRET_NOTES: { x: number; y: number; size: number; rot: number; lines: string[] }[] = [
  { x: 90, y: 520, size: 22, rot: -4, lines: ["L’acqua che tocchi de’ fiumi", "è l’ultima di quella che andò", "e la prima di quella che viene."] },
  { x: 1050, y: 120, size: 19, rot: 3, lines: ["Chi poco pensa, molto erra."] },
  { x: 1120, y: 620, size: 17, rot: -2, lines: ["L’occhio, che si dice finestra", "dell’anima, è la principale via", "donde il comune senso può…"] },
  { x: 160, y: 120, size: 16, rot: 5, lines: ["Ogni nostra cognizione", "principia da’ sentimenti."] },
];

// Static gradients for the light layers (radii in % of the layer's half-size).
// The darkness layer is 4× the screen diagonal; the lit radius is 0.34 diagonal = 17%.
const DARK_GRADIENT =
  "radial-gradient(circle closest-side, rgba(24,12,4,0) 0%, rgba(24,12,4,0.18) 5.1%, rgba(20,10,3,0.55) 11.6%, rgba(14,7,2,0.84) 17%, rgba(14,7,2,0.84) 100%)";
const GLOW_GRADIENT =
  "radial-gradient(circle closest-side, rgba(255,186,104,0.34) 0%, rgba(255,160,80,0.12) 45%, rgba(255,150,70,0) 100%)";
const SECRET_MASK = "radial-gradient(circle closest-side, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const secretRef = useRef<HTMLDivElement>(null);
  const secretInnerRef = useRef<HTMLDivElement>(null);
  const strikeRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLDivElement>(null);
  const light = useRef<Light>({ x: 0, y: 0, r: 0, on: 0 });
  const reduce = useReducedMotion();
  const [splats, setSplats] = useState<Splat[]>([]);

  // Scroll: fall into the orrery as the darkness lifts.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Capped at 4×: zooming the heavy 3D layers further exhausts GPU tile memory
  // and makes them flicker or drop out when scrolling back up.
  const dive = useTransform(scrollYProgress, [0, 1], [1, 4], { ease: (t) => t * t * t });
  const spin = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const stageFade = useTransform(scrollYProgress, [0.55, 0.9], [1, 0]);
  const dawn = useTransform(scrollYProgress, [0.3, 0.9], [1, 0]);
  const veil = useTransform(scrollYProgress, [0.66, 0.92], [1, 0]);
  const titleFade = useTransform(scrollYProgress, [0, 0.28], [1, 0]);
  const titleLift = useTransform(scrollYProgress, [0, 0.28], [0, -90]);

  // The candle: follows the hand with a lag, flickers, and wanders when left alone.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const target = { x: room.clientWidth / 2, y: room.clientHeight * 0.46 };
    light.current.x = target.x;
    light.current.y = target.y;
    let lastMove = -1e9;
    const onMove = (e: PointerEvent) => {
      const b = room.getBoundingClientRect();
      if (e.clientY < b.top || e.clientY > b.bottom) return;
      target.x = e.clientX - b.left;
      target.y = e.clientY - b.top;
      lastMove = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const start = performance.now();
    let raf = 0;
    // Once the hero has scrolled away, stop the candle loop and freeze the
    // orrery's spinning rings so they stop costing frames in later folios.
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => {
      // Coming back up to the desk: the candle is struck again.
      if (e.isIntersecting && !onScreen) sound.strike();
      onScreen = e.isIntersecting;
      room.toggleAttribute("data-paused", !onScreen);
    });
    io.observe(room);
    // The wick pops now and then while you're at the desk.
    const crackles = window.setInterval(() => {
      if (onScreen && Math.random() < 0.45) sound.crackle();
    }, 2600);
    const tick = (now: number) => {
      if (!onScreen) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = (now - start) / 1000;
      const w = room.clientWidth;
      const h = room.clientHeight;
      // Wander in a slow figure-of-eight when nobody is holding the candle.
      if (now - lastMove > 3500 || !fine) {
        target.x = w / 2 + Math.sin(t * 0.23) * w * 0.28;
        target.y = h * 0.47 + Math.sin(t * 0.37 + 1) * h * 0.2;
      }
      const L = light.current;
      L.x += (target.x - L.x) * (reduce ? 1 : 0.075);
      L.y += (target.y - L.y) * (reduce ? 1 : 0.075);
      // The candle is struck, catches, then settles into a living flicker.
      const strike = reduce ? 1 : Math.min(1, Math.max(0, (t - 0.35) / 1.5));
      L.on = 1 - (1 - strike) ** 3;
      const flicker = reduce
        ? 1
        : 1 + 0.035 * Math.sin(t * 7.1) + 0.022 * Math.sin(t * 13.7 + 1.3) + 0.014 * Math.sin(t * 23.3 + 0.4);
      L.r = Math.max(2, Math.hypot(w, h) * 0.34 * L.on * flicker);

      const { x, y, r } = L;
      // Lighting moves by transform only (no repaint): each light layer is a
      // fixed gradient that is translated to the flame and scaled by its flicker.
      const D = Math.hypot(w, h);
      const R0 = D * 0.34;
      const k = Math.max(0.6, r / R0);
      if (darkRef.current) {
        const S = D * 4;
        const el = darkRef.current;
        if (el.dataset.size !== String(Math.round(S))) {
          el.dataset.size = String(Math.round(S));
          el.style.width = el.style.height = `${S}px`;
        }
        el.style.transform = `translate3d(${x - S / 2}px, ${y - S / 2}px, 0) scale(${k})`;
      }
      if (strikeRef.current) strikeRef.current.style.opacity = String(1 - L.on);
      if (glowRef.current) {
        const S = R0 * 2;
        const el = glowRef.current;
        el.style.width = el.style.height = `${S}px`;
        el.style.transform = `translate3d(${x - S / 2}px, ${y - S / 2}px, 0) scale(${k * 0.85})`;
        el.style.opacity = String(L.on);
      }
      if (secretRef.current && secretInnerRef.current) {
        // A round window that travels with the flame while its contents stay
        // pinned to the desk, so the hidden ink is revealed in place.
        const S = R0 * 1.3;
        const el = secretRef.current;
        el.style.width = el.style.height = `${S}px`;
        el.style.transform = `translate3d(${x - S / 2}px, ${y - S / 2}px, 0)`;
        const inner = secretInnerRef.current;
        inner.style.width = `${w}px`;
        inner.style.height = `${h}px`;
        inner.style.transform = `translate3d(${S / 2 - x}px, ${S / 2 - y}px, 0)`;
        el.style.opacity = String(L.on);
      }
      if (flameRef.current) {
        flameRef.current.style.left = `${x}px`;
        flameRef.current.style.top = `${y}px`;
        // The flame goes out with the dawn so it never hangs over the next folio.
        flameRef.current.style.opacity = String(fine ? L.on * dawn.get() : 0);
      }
      if (tiltRef.current && !reduce) {
        const rx = ((y / h) - 0.5) * -16;
        const ry = ((x / w) - 0.5) * 18;
        tiltRef.current.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      io.disconnect();
      window.clearInterval(crackles);
    };
  }, [reduce, dawn]);

  const spill = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("a")) return;
    const b = e.currentTarget.getBoundingClientRect();
    const splat = { id: Date.now(), x: e.clientX - b.left, y: e.clientY - b.top, seed: Math.floor(Math.random() * 1e6) + 1 };
    setSplats((s) => [...s.slice(-13), splat]);
  }, []);

  const appear = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, scale: 0.9, filter: "blur(6px)" },
          animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
          transition: { delay, duration: 1.6, ease: [0.2, 0.7, 0.2, 1] as const },
        };

  // Layers of the orrery, back to front, each at its own depth.
  const layers = [
    { z: -60, el: <BandLayer />, delay: 0.9 },
    { z: 0, el: <GearLayer />, delay: 1.1 },
    { z: 30, el: <PlanetLayer />, delay: 1.25 },
    { z: 80, el: <HeartLayer />, delay: 1.4 },
    { z: 130, el: <MedallionLayer />, delay: 1.6 },
  ];

  return (
    <section ref={ref} id="hero" className="relative z-20 h-[230vh]">
      <div ref={roomRef} className="sticky top-0 h-svh cursor-none overflow-hidden [@media(pointer:coarse)]:cursor-auto" onClick={spill}>
        {/* The hero's own sheet of paper. Folio I is already pinned underneath;
            this veil dissolves as you fall through the orrery to reveal it. */}
        <motion.div aria-hidden className="paper-veil absolute inset-0" style={{ opacity: veil }} />
        {/* The desk: ink blots and the orrery share the dive transform. */}
        <motion.div className="absolute inset-0 will-change-transform" style={reduce ? undefined : { scale: dive, rotate: spin, opacity: stageFade }}>
          {splats.map((s) => (
            <InkSplat key={s.id} splat={s} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center [perspective:1400px]">
            <div
              ref={tiltRef}
              className="relative aspect-square w-[min(108svh,104vw)] [transform-style:preserve-3d] [transition:transform_0.1s_linear]"
            >
              {layers.map(({ z, el, delay }, i) => (
                <motion.div
                  key={i}
                  className="pointer-events-none absolute inset-0 [transform-style:preserve-3d]"
                  style={{ transform: `translateZ(${z}px)` }}
                >
                  <motion.div className="absolute inset-0 [transform-style:preserve-3d]" {...appear(delay)}>
                    <div className={`absolute inset-0 [transform-style:preserve-3d] ${i === 0 ? "animate-[orrery-spin_240s_linear_infinite]" : i === 1 ? "animate-[orrery-spin-rev_120s_linear_infinite]" : ""}`}>
                      {el}
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Invisible ink, revealed only where the candlelight falls. */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: dawn }}>
          <div
            ref={secretRef}
            className="absolute top-0 left-0 overflow-hidden will-change-transform"
            style={{ maskImage: SECRET_MASK, WebkitMaskImage: SECRET_MASK }}
          >
          <div ref={secretInnerRef} className="absolute top-0 left-0 will-change-transform">
          <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full text-rust">
            <g fill="none" stroke="currentColor" strokeLinecap="round">
              {VORTICES.map((d, i) => (
                <path key={i} d={d} strokeWidth={0.9} opacity={0.75} />
              ))}
              <path d={EYE} strokeWidth={0.8} opacity={0.7} />
            </g>
            {SECRET_NOTES.map((n, i) => (
              <g key={i} transform={`translate(${n.x} ${n.y}) rotate(${n.rot}) scale(-1 1)`}>
                {n.lines.map((l, k) => (
                  <text key={k} y={k * n.size * 1.45} textAnchor="end" className="fill-rust" style={{ fontFamily: "var(--font-aurore)", fontSize: n.size }} opacity={0.8}>
                    {l}
                  </text>
                ))}
              </g>
            ))}
          </svg>
          </div>
          </div>
        </motion.div>

        {/* Night: everything beyond the candle's reach falls into shadow. */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: reduce ? 0 : dawn }}>
          <div ref={darkRef} className="absolute top-0 left-0 will-change-transform" style={{ background: DARK_GRADIENT }} />
          <div ref={glowRef} className="absolute top-0 left-0 mix-blend-soft-light will-change-transform" style={{ background: GLOW_GRADIENT }} />
          {/* Before the candle is struck the room is simply dark. */}
          <div ref={strikeRef} className="absolute inset-0" style={{ background: "rgb(14 7 2 / 0.86)" }} />
          <Dust light={light} />
        </motion.div>

        {/* The flame itself, floating where your hand is. */}
        <div ref={flameRef} aria-hidden className="pointer-events-none absolute z-30 opacity-0">
          <div className="h-10 w-5 animate-[flame-flicker_0.9s_ease-in-out_infinite] rounded-[50%_50%_45%_45%/65%_65%_35%_35%] bg-[radial-gradient(ellipse_at_50%_75%,#fff8e0_0%,#ffd27a_30%,#ff9a3c_60%,rgba(255,120,40,0)_75%)] blur-[0.6px]" />
          <div className="absolute top-0 left-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,200,120,0.35),transparent_65%)]" />
        </div>

        {/* Title, gilded like an illuminated manuscript and written by an unseen quill. */}
        <motion.div className="pointer-events-none absolute inset-x-0 top-[7svh] z-20 px-4 text-center" style={reduce ? undefined : { opacity: titleFade, y: titleLift }}>
          <motion.p
            className="font-caps text-xs tracking-[0.5em] text-[#e9cf98] uppercase [text-shadow:0_1px_8px_rgba(0,0,0,0.8)] sm:text-sm"
            initial={reduce ? false : { opacity: 0, letterSpacing: "1.2em" }}
            animate={{ opacity: 1, letterSpacing: "0.5em" }}
            transition={{ delay: 2.2, duration: 2 }}
          >
            Il museo delle macchine
          </motion.p>
          <svg viewBox="0 0 1000 250" className="mx-auto mt-2 w-[min(92vw,860px)] overflow-visible" role="img" aria-label="The Codex of Machines">
            <defs>
              <linearGradient id="gilt" x1="0" y1="0" x2="1" y2="0.35">
                <stop offset="0%" stopColor="#a8742c" />
                <stop offset="30%" stopColor="#f6e2a8" />
                <stop offset="45%" stopColor="#c99a45" />
                <stop offset="62%" stopColor="#fff1c8" />
                <stop offset="80%" stopColor="#b07a30" />
                <stop offset="100%" stopColor="#e9c97c" />
                <animateTransform attributeName="gradientTransform" type="translate" values="-0.4 0; 0.4 0; -0.4 0" dur="9s" repeatCount="indefinite" />
              </linearGradient>
              <filter id="gilt-glow" x="-10%" y="-30%" width="120%" height="160%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
                <feOffset dy="3" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.85" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {[
              { text: "The Codex", y: 110, italic: false, delay: 1.6 },
              { text: "of Machines", y: 225, italic: true, delay: 2.4 },
            ].map((l) => (
              <motion.text
                key={l.text}
                x={500}
                y={l.y}
                textAnchor="middle"
                filter="url(#gilt-glow)"
                stroke="#2a180a"
                strokeWidth={1.6}
                strokeDasharray="900"
                style={{ fontFamily: "var(--font-fell)", fontSize: 118, fontStyle: l.italic ? "italic" : "normal", fill: "url(#gilt)" }}
                initial={reduce ? false : { strokeDashoffset: 900, fillOpacity: 0 }}
                animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
                transition={{ strokeDashoffset: { delay: l.delay, duration: 2.6, ease: [0.5, 0, 0.3, 1] }, fillOpacity: { delay: l.delay + 1.7, duration: 1.4 } }}
              >
                {l.text}
              </motion.text>
            ))}
          </svg>
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-[6svh] z-20 px-4 text-center"
          style={reduce ? undefined : { opacity: titleFade }}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 4, duration: 1.4 }}
        >
          <p className="mx-auto max-w-md text-lg text-[#ecd9b0] italic [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
            Five inventions from the notebooks of Leonardo da Vinci, drawn in ink and set in motion by your scroll.
          </p>
          <p className="mt-3 font-script text-xl text-[#e0b97a] [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
            <span className="[@media(pointer:coarse)]:hidden">carry the candle · spill some ink · touch a charm</span>
            <span className="hidden [@media(pointer:coarse)]:inline">tap a charm to visit it · scroll to descend</span>
          </p>
          <svg width="22" height="40" viewBox="0 0 22 44" fill="none" stroke="#e0b97a" strokeWidth="1.4" strokeLinecap="round" className="mx-auto mt-2" aria-hidden>
            <path d="M11 2C9 14 13 26 11 40M4 32l7 9 7-9" />
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
