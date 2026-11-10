"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Where the candle is and how far its light reaches, shared by every lit layer. */
export type Light = { x: number; y: number; r: number; on: number };

/*
 * Dust motes drifting through the candlelight. Each mote is only visible when
 * it is inside the pool of light, brightest near the flame, which is what
 * makes the air of the room feel present.
 */
export function Dust({ light }: { light: RefObject<Light> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const motes = Array.from({ length: 220 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.7, // depth: nearer motes are bigger and faster
      vx: (Math.random() - 0.5) * 0.00012,
      vy: -0.00004 - Math.random() * 0.0001,
      ph: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    io.observe(canvas);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!onScreen) return;
      const L = light.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const m of motes) {
        // Slow Brownian drift with a lazy updraft from the flame's heat.
        m.ph += 0.01;
        m.x += m.vx + Math.sin(m.ph + t * 0.0003) * 0.00005;
        m.y += m.vy * m.z;
        if (m.y < -0.02) m.y = 1.02;
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;
        const px = m.x * w;
        const py = m.y * h;
        const d = Math.hypot(px - L.x, py - L.y) / Math.max(1, L.r);
        const glow = Math.max(0, 1 - d) ** 2 * L.on;
        if (glow < 0.01) continue;
        const twinkle = 0.6 + 0.4 * Math.sin(m.ph * 3);
        const size = 0.6 + m.z * 1.6;
        ctx.fillStyle = `rgba(255, 214, 150, ${glow * twinkle * 0.75})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [light]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** Ink blots: click the desk and a drop of ink lands, blooms into the fibres and dries. */
export type Splat = { id: number; x: number; y: number; seed: number };

function blob(seed: number) {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const n = 22;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rad = 26 + r() * 14 + (r() < 0.2 ? r() * 22 : 0);
    return [Math.cos(a) * rad, Math.sin(a) * rad];
  });
  // Smooth closed curve through the points.
  let d = `M${(pts[0][0] + pts[n - 1][0]) / 2} ${(pts[0][1] + pts[n - 1][1]) / 2}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  }
  const drops = Array.from({ length: 9 }, () => {
    const a = r() * Math.PI * 2;
    const dist = 48 + r() * 60;
    const rr = 1 + r() * 4.5;
    return { x: Math.cos(a) * dist, y: Math.sin(a) * dist, r: rr };
  });
  const streaks = Array.from({ length: 4 }, () => {
    const a = r() * Math.PI * 2;
    const l = 40 + r() * 50;
    return `M${(Math.cos(a) * 30).toFixed(1)} ${(Math.sin(a) * 30).toFixed(1)}L${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l).toFixed(1)}`;
  });
  return { d, drops, streaks: streaks.join("") };
}

export function InkSplat({ splat }: { splat: Splat }) {
  const { d, drops, streaks } = blob(splat.seed);
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute overflow-visible"
      style={{ left: splat.x, top: splat.y, width: 1, height: 1 }}
    >
      <g className="ink-splat" style={{ transformOrigin: "0 0" }}>
        <g filter="url(#bleed-heavy)" className="text-ink">
          <path d={d} fill="currentColor" opacity={0.88} />
          <path d={streaks} stroke="currentColor" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          {drops.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="currentColor" />
          ))}
        </g>
        {/* The drying ring: pigment migrates to the edge of a drying drop. */}
        <path d={d} fill="none" stroke="#1b1008" strokeWidth={2.2} opacity={0.5} filter="url(#bleed-heavy)" />
      </g>
    </svg>
  );
}
