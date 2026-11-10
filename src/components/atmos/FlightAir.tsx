"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import { WING_EDGE, WING_PIVOTS, flapAngle, liftHeight } from "@/components/machines/Ornithopter";
import { sound } from "@/lib/sound";

/*
 * The living air around the flying machine, in the spirit of Leonardo's
 * studies of wind and water.
 *
 *  - Wind: ~500 ink tracers ride a velocity field and leave fading strokes,
 *    so you see the air as Leonardo drew it, in streamlines.
 *  - Vortices: every wingbeat sheds a real point vortex from each wingtip and
 *    trailing edge (strength = how fast the wing is moving). They drift
 *    downwind, decay, and visibly curl the streamlines into eddies. Downstrokes
 *    also push a column of air down beneath the machine.
 *  - Your cursor is a gust: moving it through the drawing pushes the air.
 *  - Swallows: a flock (boids) wheels through the sky, scatters from your
 *    hand, and once the machine lifts off it gathers round as an escort.
 *  - Feathers shaken loose by hard wingbeats tumble down on their own swaying
 *    path and come to rest on the ground line.
 *  - Ink-hatched clouds drift by, faster as the wind rises.
 *
 * Everything is simulated in the drawing's own coordinates (the 600×480
 * viewBox) and mapped onto the canvas with the SVG's screen matrix, so it
 * lines up exactly with the ink at any size.
 */

type Vortex = { x: number; y: number; g: number; age: number };
type Tracer = { x: number; y: number; px: number; py: number; life: number };
type Bird = { x: number; y: number; vx: number; vy: number; ph: number; size: number };
type Feather = { x: number; y: number; ph: number; vy: number; len: number; rest: number; rot: number };

const W = 600;
const H = 480;
const GROUND = 468;
const range = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

function wingPoint(side: "left" | "right", local: [number, number], angle: number, lift: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  const rx = local[0] * Math.cos(a) - local[1] * Math.sin(a);
  const ry = local[0] * Math.sin(a) + local[1] * Math.cos(a);
  const [px, py] = WING_PIVOTS[side];
  return side === "right" ? [px + rx, py + ry + lift] : [px - rx, py + ry + lift];
}

function cloudPath(cx: number, cy: number, w: number, seed: number) {
  const p = new Path2D();
  const bumps = 6;
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  p.moveTo(cx - w / 2, cy);
  for (let i = 0; i < bumps; i++) {
    const x0 = cx - w / 2 + (w * i) / bumps;
    const x1 = cx - w / 2 + (w * (i + 1)) / bumps;
    const hgt = (0.35 + r() * 0.5) * w * 0.28 * Math.sin(((i + 0.5) / bumps) * Math.PI);
    p.bezierCurveTo(x0, cy - hgt, x1, cy - hgt, x1, cy);
  }
  p.quadraticCurveTo(cx, cy + w * 0.06, cx - w / 2, cy);
  return p;
}

export function FlightAir({ p, svgRef }: { p: MotionValue<number>; svgRef: RefObject<SVGSVGElement | null> }) {
  const trailRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const trail = trailRef.current;
    const live = liveRef.current;
    const tctx = trail?.getContext("2d");
    const lctx = live?.getContext("2d");
    if (!trail || !live || !tctx || !lctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const host = trail.parentElement!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const tracers: Tracer[] = Array.from({ length: 520 }, () => {
      const x = -60 + Math.random() * (W + 120);
      const y = Math.random() * H;
      return { x, y, px: x, py: y, life: Math.random() * 400 };
    });
    const vortices: Vortex[] = [];
    const birds: Bird[] = Array.from({ length: 16 }, (_, i) => ({
      x: -80 - Math.random() * 300,
      y: 50 + Math.random() * 170,
      vx: 1.4 + Math.random() * 0.6,
      vy: (Math.random() - 0.5) * 0.4,
      ph: Math.random() * Math.PI * 2,
      size: 5.5 + (i % 4) * 1.2,
    }));
    const feathers: Feather[] = [];
    const clouds = [
      { x: 90, y: 70, w: 120, seed: 3 },
      { x: 360, y: 48, w: 170, seed: 11 },
      { x: 560, y: 96, w: 100, seed: 29 },
    ];

    const pointer = { x: -999, y: -999, vx: 0, vy: 0, t: 0 };
    let toView: DOMMatrix | null = null;
    let screenInv: DOMMatrix | null = null;
    const onMove = (e: PointerEvent) => {
      if (!screenInv) return;
      const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(screenInv);
      if (pointer.t) {
        pointer.vx = pointer.vx * 0.5 + (q.x - pointer.x) * 0.5;
        pointer.vy = pointer.vy * 0.5 + (q.y - pointer.y) * 0.5;
      }
      pointer.x = q.x;
      pointer.y = q.y;
      pointer.t = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(host);

    // Layout is measured only when it can change (resize), never per frame:
    // reading it every frame forces the browser to recalculate layout.
    let stale = true;
    const ro = new ResizeObserver(() => (stale = true));
    ro.observe(host);
    window.addEventListener("resize", () => (stale = true));
    const fit = () => {
      if (!stale) return;
      stale = false;
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const c of [trail, live]) {
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
      }
      const m = svgRef.current?.getScreenCTM();
      const box = host.getBoundingClientRect();
      if (m) {
        toView = new DOMMatrix([m.a * dpr, 0, 0, m.d * dpr, (m.e - box.left) * dpr, (m.f - box.top) * dpr]);
        screenInv = m.inverse();
      }
    };

    let lastFlap = flapAngle(p.get());
    let lastD = 0;
    
    let frame = 0;
    let raf = 0;

    const velocity = (x: number, y: number, wind: number, lift: number, beat: number) => {
      // Steady wind with a little large-scale meander.
      let u = wind * (1 + 0.25 * Math.sin(y * 0.02 + frame * 0.01));
      let v = wind * 0.18 * Math.sin(x * 0.015 + frame * 0.013);
      for (const k of vortices) {
        const dx = x - k.x;
        const dy = y - k.y;
        const r2 = dx * dx + dy * dy + 160;
        u += (-k.g * dy) / r2;
        v += (k.g * dx) / r2;
      }
      // Downwash: a downstroke drives a column of air under the machine.
      if (beat > 0) {
        const dx = (x - 300) / 150;
        const dy = y - (230 + lift);
        if (dy > 0 && dx * dx < 1) v += beat * 0.9 * (1 - dx * dx) * Math.exp(-dy / 160);
      }
      // The reader's hand as a gust.
      const age = performance.now() - pointer.t;
      if (age < 600) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const f = Math.exp(-(dx * dx + dy * dy) / 3200) * (1 - age / 600);
        u += pointer.vx * 0.8 * f;
        v += pointer.vy * 0.8 * f;
      }
      return [u, v] as const;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      frame++;
      // Re-measure occasionally (the folio slides into its pinned position).
      if (frame % 20 === 0) stale = true;
      fit();
      if (!toView) return;
      const v = p.get();
      const presence = range(v, 0.14, 0.3);
      const flap = flapAngle(v);
      const lift = liftHeight(v);
      const dFlap = flap - lastFlap;
      lastFlap = flap;
      // Each new downstroke is heard as a wingbeat, as hard as you drove it.
      if (dFlap > 0.08 && lastD <= 0.08) sound.flap(Math.min(1, dFlap / 2.2));
      lastD = dFlap;
      const beat = Math.max(0, Math.min(3, dFlap)); // downstroke strength
      const wind = 0.45 + 0.9 * range(v, 0.36, 0.5) + 0.6 * range(v, 0.66, 1);

      // Shed vortices from the moving wing, opposite spin on each side.
      if (Math.abs(dFlap) > 0.05 && vortices.length < 46) {
        for (const local of [WING_EDGE[0], WING_EDGE[2]]) {
          const g = Math.max(-14, Math.min(14, dFlap * 10));
          const [rx, ry] = wingPoint("right", local, flap, lift);
          const [lx, ly] = wingPoint("left", local, flap, lift);
          vortices.push({ x: rx, y: ry, g, age: 0 }, { x: lx, y: ly, g: -g, age: 0 });
        }
      }
      for (let i = vortices.length - 1; i >= 0; i--) {
        const k = vortices[i];
        k.age++;
        k.g *= 0.985;
        k.x += wind * 0.9;
        k.y += 0.05;
        if (k.age > 260 || Math.abs(k.g) < 0.3 || k.x > W + 80) vortices.splice(i, 1);
      }

      // Fade the old strokes so streamlines leave short living trails.
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalCompositeOperation = "destination-out";
      tctx.fillStyle = "rgba(0,0,0,0.025)";
      tctx.fillRect(0, 0, trail.width, trail.height);
      tctx.globalCompositeOperation = "source-over";
      tctx.setTransform(toView);
      tctx.lineWidth = 0.7;
      tctx.lineCap = "round";
      tctx.strokeStyle = `rgba(110, 74, 42, ${0.36 * presence})`;
      tctx.beginPath();
      for (const t of tracers) {
        const [u, w] = velocity(t.x, t.y, wind, lift, beat);
        t.px = t.x;
        t.py = t.y;
        t.x += u;
        t.y += w;
        t.life--;
        if (t.x > W + 60 || t.y < -40 || t.y > H + 10 || t.life < 0) {
          // Expired tracers reappear anywhere; ones blown off the edge re-enter upwind.
          t.x = t.life < 0 ? -60 + Math.random() * (W + 60) : -60 + Math.random() * 40;
          t.y = Math.random() * H;
          t.px = t.x;
          t.py = t.y;
          t.life = 300 + Math.random() * 300;
          continue;
        }
        tctx.moveTo(t.px, t.py);
        tctx.lineTo(t.x, t.y);
      }
      if (presence > 0) tctx.stroke();

      // ── The live layer: clouds, birds, feathers (redrawn every frame) ──────
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, live.width, live.height);
      lctx.setTransform(toView);
      lctx.lineCap = "round";
      lctx.lineJoin = "round";

      for (const c of clouds) {
        c.x += 0.06 * (1 + wind);
        if (c.x - c.w > W + 40) c.x = -c.w;
        const path = cloudPath(c.x, c.y, c.w, c.seed);
        lctx.save();
        lctx.globalAlpha = 0.5 * presence;
        lctx.strokeStyle = "rgba(110,74,42,0.9)";
        lctx.lineWidth = 0.8;
        lctx.stroke(path);
        lctx.clip(path);
        lctx.lineWidth = 0.35;
        lctx.beginPath();
        for (let i = -c.w; i < c.w; i += 4) {
          lctx.moveTo(c.x + i, c.y + 4);
          lctx.lineTo(c.x + i + c.w * 0.25, c.y - c.w * 0.3);
        }
        lctx.stroke();
        lctx.restore();
      }

      // Swallows: separation, alignment, cohesion, fear of the hand, and an
      // escort orbit once the machine is airborne.
      const escort = range(v, 0.66, 0.8);
      const birdsIn = range(v, 0.02, 0.1);
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        let ax = 0;
        let ay = 0;
        let cx = 0;
        let cy = 0;
        let avx = 0;
        let avy = 0;
        let n = 0;
        for (const o of birds) {
          if (o === b) continue;
          const dx = o.x - b.x;
          const dy = o.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 3600) {
            n++;
            cx += o.x;
            cy += o.y;
            avx += o.vx;
            avy += o.vy;
            if (d2 < 260) {
              ax -= dx * 0.004;
              ay -= dy * 0.004;
            }
          }
        }
        if (n) {
          ax += (cx / n - b.x) * 0.0006 + (avx / n - b.vx) * 0.03;
          ay += (cy / n - b.y) * 0.0006 + (avy / n - b.vy) * 0.03;
        }
        const pdx = b.x - pointer.x;
        const pdy = b.y - pointer.y;
        const pd2 = pdx * pdx + pdy * pdy;
        if (pd2 < 6400 && performance.now() - pointer.t < 2000) {
          ax += (pdx / Math.sqrt(pd2 + 1)) * 0.25;
          ay += (pdy / Math.sqrt(pd2 + 1)) * 0.25;
        }
        if (escort > 0) {
          const a = frame * 0.012 + (i / birds.length) * Math.PI * 2;
          const tx = 300 + Math.cos(a) * (170 + (i % 3) * 22);
          const ty = 200 + lift + Math.sin(a) * (70 + (i % 4) * 10);
          ax += (tx - b.x) * 0.0016 * escort;
          ay += (ty - b.y) * 0.0016 * escort;
        } else {
          // Keep to the sky above the drawing.
          if (b.y < 30) ay += 0.03;
          if (b.y > 230) ay -= 0.03;
          ax += 0.006;
        }
        b.vx += ax;
        b.vy += ay;
        const sp = Math.hypot(b.vx, b.vy);
        const max = 2.6;
        const min = 1.1;
        const k = sp > max ? max / sp : sp < min ? min / sp : 1;
        b.vx *= k;
        b.vy *= k;
        b.x += b.vx * birdsIn;
        b.y += b.vy * birdsIn;
        if (escort === 0 && b.x > W + 80) {
          b.x = -60;
          b.y = 40 + Math.random() * 180;
        }
        b.ph += 0.22 + sp * 0.05;

        // A quick ink swallow: two swept wing strokes and a forked tail.
        const s = b.size;
        const flapY = Math.sin(b.ph) * s * 0.55;
        const head = Math.atan2(b.vy, b.vx);
        lctx.save();
        lctx.translate(b.x, b.y);
        lctx.rotate(head * 0.35);
        lctx.globalAlpha = birdsIn * 0.85;
        lctx.strokeStyle = "#3a2717";
        lctx.lineWidth = 1.05;
        lctx.beginPath();
        lctx.moveTo(-s * 1.15, flapY - s * 0.1);
        lctx.quadraticCurveTo(-s * 0.45, -s * 0.15 + flapY * 0.2, 0, 0);
        lctx.quadraticCurveTo(s * 0.45, -s * 0.15 + flapY * 0.2, s * 1.15, flapY - s * 0.1);
        lctx.moveTo(0, 0);
        lctx.lineTo(Math.sign(b.vx || 1) * -s * 0.5, s * 0.25);
        lctx.lineTo(Math.sign(b.vx || 1) * -s * 0.8, s * 0.5);
        lctx.moveTo(Math.sign(b.vx || 1) * -s * 0.5, s * 0.25);
        lctx.lineTo(Math.sign(b.vx || 1) * -s * 0.7, s * 0.6);
        lctx.stroke();
        lctx.restore();
      }

      // Feathers: shaken loose by hard downstrokes.
      if (beat > 1.4 && feathers.length < 14 && Math.random() < 0.08) {
        const side = Math.random() < 0.5 ? "left" : "right";
        const local = WING_EDGE[1 + Math.floor(Math.random() * 4)];
        const [fx, fy] = wingPoint(side, local, flap, lift);
        feathers.push({ x: fx, y: fy, ph: Math.random() * 6, vy: 0.35 + Math.random() * 0.3, len: 13 + Math.random() * 9, rest: 0, rot: 0 });
      }
      for (let i = feathers.length - 1; i >= 0; i--) {
        const f = feathers[i];
        if (f.y < GROUND - 2) {
          // Falling leaf motion: sway side to side, slowest at the turns.
          f.ph += 0.045;
          f.x += Math.cos(f.ph) * 0.7 + wind * 0.25;
          f.y += f.vy * (0.5 + 0.5 * Math.abs(Math.sin(f.ph)));
          f.rot = Math.sin(f.ph) * 0.7 + 1.2;
        } else {
          f.rest++;
          f.rot += (Math.PI / 2 - 0.15 - f.rot) * 0.1;
        }
        if (f.rest > 900 || f.x > W + 40) {
          feathers.splice(i, 1);
          continue;
        }
        const L = f.len;
        lctx.save();
        lctx.translate(f.x, f.y);
        lctx.rotate(f.rot);
        lctx.globalAlpha = Math.min(1, (900 - f.rest) / 200) * 0.9;
        lctx.strokeStyle = "#5a3a20";
        lctx.lineWidth = 0.7;
        lctx.beginPath();
        lctx.moveTo(0, -L / 2);
        lctx.quadraticCurveTo(L * 0.05, 0, 0, L / 2 + 3);
        lctx.moveTo(0, -L / 2);
        lctx.bezierCurveTo(L * 0.28, -L * 0.3, L * 0.26, L * 0.3, 0, L / 2);
        lctx.moveTo(0, -L / 2);
        lctx.bezierCurveTo(-L * 0.22, -L * 0.3, -L * 0.2, L * 0.3, 0, L / 2);
        lctx.stroke();
        lctx.lineWidth = 0.3;
        lctx.beginPath();
        for (let k = 1; k < 8; k++) {
          const y = -L / 2 + (L * k) / 8;
          const wv = Math.sin((k / 8) * Math.PI) * L * 0.22;
          lctx.moveTo(0, y);
          lctx.lineTo(wv, y - L * 0.06);
          lctx.moveTo(0, y);
          lctx.lineTo(-wv * 0.85, y - L * 0.06);
        }
        lctx.stroke();
        lctx.restore();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [p, svgRef]);

  return (
    <>
      <canvas ref={trailRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={liveRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </>
  );
}
