"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type RefObject } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { sound } from "@/lib/sound";
import { LabelProjector, MachineFrame, PAPER, SPOT, type Drive, type PartDef, type Vec3 } from "./kit";

/*
 * The 3D room every machine opens into.
 *
 *  Anatomia: the machine on a drafting table. Hover a part to ink it in red,
 *  click it (or pick it from the list) and the camera glides in to magnify it
 *  while the rest fades back; explode it apart; step through the parts.
 *
 *  The action tab: the machine at work in its own scene, with camera views to
 *  watch from, including a free orbit.
 */

export type ViewDef = { id: string; it: string; en: string; offset: Vec3 };

export type RoomConfig = {
  folio: string;
  title: string;
  ariaLabel: string;
  parts: PartDef[];
  /** `wide`: where the camera stands back to when the model is exploded and nothing is picked. */
  overview: { target: Vec3; camera: Vec3; wide?: Vec3 };
  /** The machine; `drive` animates it (wingbeat, spin, crank…). */
  Model: ComponentType<{ drive: Drive }>;
  rest: number;
  animate: (t: number) => number;
  /**
   * What the moving model sounds like on the drafting table. Called every
   * frame it is playing with its drive value now, a frame ago and two frames
   * ago, so a cue can be tied to the motion itself: a tooth passed, a turn
   * completed, a stroke reversed.
   */
  voice?: (drive: number, was: number, before: number) => void;
  play: [string, string];
  /** Height of the model's base above the drafting table. */
  lift?: number;
  /** Size of the shadow camera around the model. */
  extent?: number;
  /** Name for the whole thing in the parts list (default: the whole machine). */
  whole?: string;
  /** A line of credit or caveat shown under the model. */
  note?: string;
  action: { label: string; Scene: ComponentType<{ view: string }>; views: ViewDef[]; hint?: string; start: Vec3; far?: number };
};

// ── Following camera, shared by the action scenes ─────────────────────────────
export type Subject = { pos: THREE.Vector3; yaw: number; look?: THREE.Vector3 };

/** Puts the camera at a view's offset (in the subject's heading frame), or hands over to a free orbit. */
export function FollowCamera({
  subject,
  view,
  views,
  minDistance = 3,
  maxDistance = 60,
  minY = -Infinity,
}: {
  subject: RefObject<Subject>;
  view: string;
  views: ViewDef[];
  minDistance?: number;
  maxDistance?: number;
  /** Keep the camera above the ground. */
  minY?: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const tmp = useRef({ off: new THREE.Vector3(), want: new THREE.Vector3(), last: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), first: true });
  const offset = views.find((v) => v.id === view)?.offset ?? views[0].offset;
  useFrame((_, dt) => {
    const s = subject.current;
    const t = tmp.current;
    if (t.first) {
      t.last.copy(s.pos);
      t.first = false;
    }
    if (view === "libera") {
      const c = controls.current;
      if (c) {
        camera.position.add(t.off.copy(s.pos).sub(t.last));
        c.target.copy(s.look ?? s.pos);
        c.update();
      }
    } else {
      t.off.set(...offset).applyAxisAngle(t.up, s.yaw);
      t.want.copy(s.pos).add(t.off);
      t.want.y = Math.max(minY, t.want.y);
      camera.position.lerp(t.want, 1 - Math.exp(-dt * 2.2));
      camera.lookAt(s.look ?? s.pos);
    }
    t.last.copy(s.pos);
  });
  return view === "libera" ? <OrbitControls ref={controls} makeDefault enableDamping minDistance={minDistance} maxDistance={maxDistance} enablePan={false} /> : null;
}

// ── Anatomia ────────────────────────────────────────────────────────────────
function CameraRig({ parts, overview, selected, exploded, lift }: { parts: PartDef[]; overview: RoomConfig["overview"]; selected: string | null; exploded: boolean; lift: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const flying = useRef(true);
  const goal = useMemo(() => {
    const p = parts.find((x) => x.id === selected);
    const target = new THREE.Vector3(...(p ? p.target : overview.target));
    const cam = new THREE.Vector3(...(p ? p.camera : exploded && overview.wide ? overview.wide : overview.camera));
    // Follow the part to where the exploded view has moved it.
    if (p && exploded) {
      const off = new THREE.Vector3(...(p.follow ?? p.explode ?? [0, 0, 0]));
      target.add(off);
      cam.add(off);
    }
    // Part targets are given in the model's frame; the model sits at `lift`.
    target.y += lift;
    cam.y += lift;
    // Narrow (portrait) screens see less sideways, so step back to keep it framed.
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 1.2) cam.sub(target).multiplyScalar(Math.pow(1.2 / aspect, 0.75)).add(target);
    return { target, camera: cam };
  }, [parts, overview, selected, exploded, lift, size.width, size.height]);
  useEffect(() => {
    flying.current = true;
  }, [goal]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !flying.current) return;
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(goal.camera, k);
    c.target.lerp(goal.target, k);
    c.update();
    if (camera.position.distanceTo(goal.camera) < 0.01) flying.current = false;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={0.6} maxDistance={40} onStart={() => (flying.current = false)} />;
}

function AnatomyScene({
  config,
  selected,
  hovered,
  onHover,
  onSelect,
  playing,
  exploded,
  labelEls,
}: {
  config: RoomConfig;
  selected: string | null;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  playing: boolean;
  exploded: boolean;
  labelEls: RefObject<Map<string, HTMLElement>>;
}) {
  const { Model, rest, animate, voice, parts, overview, lift = 0.15, extent = 5 } = config;
  const drive = useRef(rest);
  const heard = useRef({ was: rest, before: rest });
  const explode = useRef(0);
  useFrame(({ clock }, dt) => {
    const target = playing ? animate(clock.elapsedTime) : rest;
    drive.current += (target - drive.current) * (playing ? 1 : 1 - Math.exp(-dt * 4));
    // Heard only while it is being played, not while it eases back to rest.
    const h = heard.current;
    if (playing) voice?.(drive.current, h.was, h.before);
    h.before = h.was;
    h.was = drive.current;
    // Parts glide apart and back together with a soft ease.
    explode.current += ((exploded ? 1 : 0) - explode.current) * (1 - Math.exp(-dt * 3.5));
  });
  const select = useCallback((id: string) => onSelect(id), [onSelect]);
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <fog attach="fog" args={[PAPER, extent * 2.4, extent * 6]} />
      {/* Soft studio light: warm from above, bounced paper-light from below. */}
      <hemisphereLight args={["#fff4dc", "#d9c398", 1.25]} />
      <directionalLight position={[-3, -4, -2]} intensity={0.45} color="#f3e2c0" />
      <directionalLight
        position={[extent * 0.8, extent * 1.6, extent]}
        intensity={1.6}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-far={extent * 6}
      />
      <group position={[0, lift, 0]} onPointerMissed={() => onSelect(null)}>
        <MachineFrame parts={parts} hovered={hovered} selected={selected} explode={explode} onHover={onHover} onSelect={select}>
          <Model drive={drive} />
        </MachineFrame>
      </group>
      {/* The drafting table: a ruled grid on the paper, with a soft shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow>
        <planeGeometry args={[extent * 10, extent * 10]} />
        <shadowMaterial opacity={0.16} />
      </mesh>
      <Grid
        position={[0, -0.899, 0]}
        args={[40, 40]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#b59a72"
        sectionSize={1}
        sectionThickness={1}
        sectionColor={SPOT}
        fadeDistance={extent * 4}
        fadeStrength={1.5}
        infiniteGrid
      />
      <CameraRig parts={parts} overview={overview} selected={selected} exploded={exploded} lift={lift - 0.15} />
      <LabelProjector elements={labelEls} />
    </>
  );
}

// ── The overlay ───────────────────────────────────────────────────────────────
export function ExploreRoom({ config, onClose: done }: { config: RoomConfig; onClose: () => void }) {
  const { parts, action } = config;
  // Closing plays the page-shut animation first, then unmounts.
  const [closing, setClosing] = useState(false);
  const onClose = useCallback(() => {
    setClosing(true);
    // Nothing from the scene rings on over the closing page.
    sound.hush();
    sound.pageFlip();
    window.setTimeout(done, 480);
  }, [done]);
  const [mode, setMode] = useState<"anatomia" | "azione">("anatomia");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState(action.views[0].id);
  const [exploded, setExploded] = useState(false);
  const [labels, setLabels] = useState(true);
  const labelEls = useRef(new Map<string, HTMLElement>());
  const part = parts.find((p) => p.id === selected);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Step through the parts with the arrow keys.
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        setSelected((cur: string | null) => {
          const i = cur ? parts.findIndex((p) => p.id === cur) : -1;
          const n = parts.length;
          const next = e.key === "ArrowRight" ? (i + 1) % n : (i - 1 + n) % n;
          return parts[next].id;
        });
        sound.knock();
      }
    };
    window.addEventListener("keydown", onKey);
    sound.pageFlip();
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
    };
  }, [onClose, parts]);

  const choose = useCallback((id: string | null) => {
    setSelected((cur) => {
      if (id !== cur) sound.knock();
      return id;
    });
  }, []);
  const step = (dir: 1 | -1) => {
    const i = selected ? parts.findIndex((p) => p.id === selected) : -1;
    const n = parts.length;
    choose(parts[(i + dir + n) % n].id);
  };

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={config.ariaLabel}
      className="paper-veil fixed inset-0 z-[60] flex flex-col text-ink"
      initial={{ clipPath: "inset(0% 50% 0% 50%)", opacity: 0.6 }}
      animate={closing ? { clipPath: "inset(0% 50% 0% 50%)", opacity: 0.6 } : { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }}
    >
      {/* Opens like a book from the spine; the paper keeps its grain. */}
      <div aria-hidden className="paper-grain pointer-events-none absolute inset-0 z-30" />
      <div aria-hidden className="paper-vignette pointer-events-none absolute inset-0 z-30" />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
        <div>
          <p className="font-caps text-xs tracking-[0.3em] text-rust uppercase">Folio {config.folio} · in tre dimensioni</p>
          <h2 className="font-display text-3xl leading-tight">{config.title}</h2>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-sepia/40 bg-paper/70 p-1 font-caps text-sm">
          {(
            [
              ["anatomia", "Anatomia"],
              ["azione", action.label],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                // The other scene's sounds stop with it.
                if (id !== mode) sound.hush();
                setMode(id);
              }}
              className={`rounded-full px-4 py-1.5 tracking-widest transition-colors ${mode === id ? "bg-ink text-paper" : "text-sepia hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="font-script text-2xl text-sepia hover:text-ink" aria-label="Close the 3D view">
          chiudi ✕
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <Canvas
          key={mode}
          // PCF filtering: three.js removed the soft variant R3F asks for by default.
          shadows="percentage"
          dpr={[1, 2]}
          // The scene stops with the room, so nothing in it fires a sound while the page shuts.
          frameloop={closing ? "never" : "always"}
          camera={
            mode === "anatomia"
              ? { position: config.overview.camera.map((v) => v * 2.3) as unknown as Vec3, fov: 38, near: 0.05, far: 200 }
              : { position: action.start, fov: 45, near: 0.1, far: action.far ?? 700 }
          }
          gl={{ antialias: true }}
          onCreated={({ gl }) => (gl.toneMapping = THREE.NoToneMapping)}
        >
          {mode === "anatomia" ? (
            <AnatomyScene config={config} selected={selected} hovered={hovered} onHover={setHovered} onSelect={choose} playing={playing} exploded={exploded} labelEls={labelEls} />
          ) : (
            <action.Scene view={view} />
          )}
        </Canvas>

        {mode === "anatomia" ? (
          <>
            {/* Part labels, positioned each frame by LabelProjector. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {parts.map((p) => {
                const visible = labels && (selected === null || selected === p.id || hovered === p.id);
                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      if (el) labelEls.current.set(p.id, el);
                      else labelEls.current.delete(p.id);
                    }}
                    className="absolute top-0 left-0 flex items-center gap-1.5 font-script text-lg whitespace-nowrap text-spot transition-opacity duration-300 [text-shadow:0_0_6px_rgba(233,218,185,0.95)]"
                    style={{ opacity: visible ? 1 : 0 }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-spot" />
                    {p.italian}
                  </div>
                );
              })}
            </div>
            {/* Part list: a column on wide screens, a scrolling strip of chips on phones. */}
            <nav
              aria-label="Parts"
              className="absolute inset-x-0 bottom-3 z-20 flex gap-2 overflow-x-auto px-4 pb-1 sm:inset-x-auto sm:top-3 sm:bottom-auto sm:left-4 sm:flex-col sm:gap-1 sm:overflow-visible sm:p-0"
            >
              <button
                type="button"
                onClick={() => choose(null)}
                className={`shrink-0 text-left font-caps text-sm tracking-widest max-sm:rounded-full max-sm:border max-sm:border-sepia/40 max-sm:bg-paper/85 max-sm:px-3 max-sm:py-1 ${selected === null ? "text-rust" : "text-sepia hover:text-ink"}`}
              >
                {config.whole ?? "Tutta la macchina"}
              </button>
              {parts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => choose(p.id)}
                  className={`shrink-0 text-left font-display text-lg italic transition-colors max-sm:rounded-full max-sm:border max-sm:border-sepia/40 max-sm:bg-paper/85 max-sm:px-3 max-sm:py-0.5 ${selected === p.id ? "text-spot" : hovered === p.id ? "text-ink" : "text-sepia"}`}
                >
                  {p.italian} <span className="font-body text-sm not-italic opacity-70 max-sm:hidden">· {p.english}</span>
                </button>
              ))}
            </nav>
            {/* Tools: animate, explode, labels. */}
            <div className="absolute top-3 right-4 z-20 flex flex-col items-end gap-2 sm:top-auto sm:right-auto sm:bottom-12 sm:left-4 sm:flex-row">
              {(
                [
                  [playing, () => setPlaying((v) => !v), config.play[0], config.play[1]],
                  [
                    exploded,
                    () => {
                      sound.clatter();
                      setExploded((v) => !v);
                    },
                    "esploso",
                    "explode",
                  ],
                  [labels, () => setLabels((v) => !v), "etichette", "labels"],
                ] as const
              ).map(([on, toggle, it, en]) => (
                <button
                  key={it}
                  type="button"
                  aria-pressed={on}
                  onClick={toggle}
                  className={`rounded-full border px-3 py-1 font-script text-lg transition-colors ${on ? "border-ink bg-ink text-paper" : "border-sepia/40 bg-paper/80 text-sepia hover:text-ink"}`}
                >
                  {it} <span className="font-body text-xs opacity-70">· {en}</span>
                </button>
              ))}
            </div>
            {part && (
              <aside className="absolute inset-x-4 bottom-16 z-20 rounded-sm border border-sepia/30 bg-paper/92 p-4 shadow-[0_6px_30px_rgba(58,39,23,0.18)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:p-5">
                <p className="flex items-center gap-2 font-caps text-xs tracking-[0.3em] text-rust uppercase">
                  <span className="inline-block h-2 w-5 halftone-spot-dense" />
                  {part.english}
                </p>
                <h3 className="mt-1 font-display text-2xl italic">{part.italian}</h3>
                <p className="mt-2 text-base leading-relaxed">{part.text}</p>
                <div className="mt-3 flex items-center justify-between font-script text-lg text-sepia">
                  <button type="button" onClick={() => step(-1)} className="hover:text-ink" aria-label="Previous part">
                    ← precedente
                  </button>
                  <span className="font-caps text-xs tracking-widest text-faded">
                    {parts.findIndex((p) => p.id === part.id) + 1} / {parts.length}
                  </span>
                  <button type="button" onClick={() => step(1)} className="hover:text-ink" aria-label="Next part">
                    seguente →
                  </button>
                </div>
              </aside>
            )}
            <p className="pointer-events-none absolute bottom-4 left-4 hidden font-script text-lg text-faded sm:block">drag to turn · scroll to zoom · click a part</p>
            {config.note && <p className="pointer-events-none absolute top-3 right-4 z-10 hidden max-w-xs text-right text-xs text-faded italic sm:block">{config.note}</p>}
          </>
        ) : (
          <>
            <div className="absolute inset-x-0 bottom-5 z-20 flex flex-wrap justify-center gap-2 px-4">
              {action.views.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`rounded-full border px-4 py-1.5 font-display text-base italic transition-colors ${view === v.id ? "border-ink bg-ink text-paper" : "border-sepia/40 bg-paper/80 text-sepia hover:text-ink"}`}
                >
                  {v.it} <span className="font-body text-xs not-italic opacity-70">{v.en}</span>
                </button>
              ))}
            </div>
            {action.hint && <p className="pointer-events-none absolute top-3 left-4 z-20 max-w-xs font-script text-lg text-faded">{action.hint}</p>}
            {view === "libera" && <p className="pointer-events-none absolute top-3 right-4 z-20 font-script text-lg text-faded">drag to move the camera around it</p>}
          </>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
