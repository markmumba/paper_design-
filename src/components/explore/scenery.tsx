"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { INK, PAPER, SPOT } from "./kit";

/*
 * Scenery shared by the machines' action scenes: sketched clouds, a ring of
 * inked hills on the horizon, a printed field, the sky and light, and smoke.
 */

/** A sketched cloud drawn once to a canvas and shown as a billboard. */
function useCloudTexture(seed: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 220;
    const g = c.getContext("2d")!;
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.strokeStyle = "rgba(110,74,42,0.85)";
    g.lineWidth = 3;
    g.lineCap = "round";
    const path = new Path2D();
    path.moveTo(30, 190);
    const bumps = 6;
    for (let i = 0; i < bumps; i++) {
      const x0 = 30 + (452 * i) / bumps;
      const x1 = 30 + (452 * (i + 1)) / bumps;
      const h = (60 + r() * 90) * Math.sin(((i + 0.5) / bumps) * Math.PI);
      path.bezierCurveTo(x0, 190 - h, x1, 190 - h, x1, 190);
    }
    path.quadraticCurveTo(256, 210, 30, 190);
    g.fillStyle = "rgba(233,218,185,0.92)";
    g.fill(path);
    g.stroke(path);
    g.save();
    g.clip(path);
    g.lineWidth = 1.4;
    g.strokeStyle = "rgba(110,74,42,0.35)";
    for (let x = -200; x < 600; x += 9) {
      g.beginPath();
      g.moveTo(x, 200);
      g.lineTo(x + 110, 60);
      g.stroke();
    }
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [seed]);
}

export function Cloud({ position, scale, seed }: { position: [number, number, number]; scale: number; seed: number }) {
  const tex = useCloudTexture(seed);
  return (
    <sprite position={position} scale={[scale, scale * 0.43, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} fog />
    </sprite>
  );
}


/** A distant coastline: ink hills, a town and a lighthouse, drawn once onto a ring. */
function drawCoast() {
  {
    const W = 4096;
    const H = 256;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    let s = 77;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const ridge = (base: number, amp: number, step: number, alpha: number, hatch: number) => {
      const pts: [number, number][] = [];
      for (let x = 0; x <= W; x += step) {
        const y = base - amp * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.0021 + base))) * (0.6 + 0.4 * r());
        pts.push([x, y]);
      }
      const path = new Path2D();
      path.moveTo(0, H);
      for (const [x, y] of pts) path.lineTo(x, y);
      path.lineTo(W, H);
      path.closePath();
      g.fillStyle = `rgba(233,218,185,${alpha})`;
      g.fill(path);
      g.save();
      g.clip(path);
      g.strokeStyle = `rgba(110,74,42,${alpha * 0.5})`;
      g.lineWidth = 1.2;
      for (let x = -200; x < W; x += hatch) {
        g.beginPath();
        g.moveTo(x, H);
        g.lineTo(x + 120, base - amp * 1.2);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = `rgba(80,52,28,${alpha})`;
      g.lineWidth = 2;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    };
    ridge(210, 120, 26, 0.5, 9); // far mountains, pale with haze
    ridge(236, 60, 14, 0.85, 6); // nearer hills
    // A walled town and a lighthouse on the headlands.
    g.strokeStyle = "rgba(70,45,24,0.9)";
    g.lineWidth = 2;
    for (const tx of [700, 2600]) {
      for (let i = 0; i < 6; i++) {
        const x = tx + i * 18;
        const h = 14 + r() * 26;
        g.strokeRect(x, 236 - h, 14, h);
        if (r() < 0.5) {
          g.beginPath();
          g.moveTo(x - 2, 236 - h);
          g.lineTo(x + 7, 236 - h - 12);
          g.lineTo(x + 16, 236 - h);
          g.stroke();
        }
      }
    }
    g.strokeRect(3400, 160, 14, 76);
    g.beginPath();
    g.moveTo(3396, 160);
    g.lineTo(3407, 146);
    g.lineTo(3418, 160);
    g.stroke();
    g.fillStyle = "rgba(228,87,46,0.7)";
    g.fillRect(3402, 164, 10, 10);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }
}
function useCoastTexture() {
  return useMemo(() => drawCoast(), []);
}

export function Coastline() {
  const tex = useCoastTexture();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => ref.current?.position.set(camera.position.x, 16, camera.position.z));
  return (
    <mesh ref={ref} frustumCulled={false}>
      <cylinderGeometry args={[300, 300, 40, 96, 1, true]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}


// ── Sky and light ───────────────────────────────────────────────────────────────
export const SUN_DIR = new THREE.Vector3(-160, 46, -220).normalize();

export function Sky({ fogNear = 60, fogFar = 260 }: { fogNear?: number; fogFar?: number }) {
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <fog attach="fog" args={[PAPER, fogNear, fogFar]} />
      <hemisphereLight args={["#fff4dc", "#d2b88a", 1.2]} />
      <directionalLight
        position={SUN_DIR.clone().multiplyScalar(60).setY(70)}
        intensity={1.5}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-far={200}
      />
      {/* A riso sun: a disc in the spot colour, low over the horizon. */}
      <mesh position={SUN_DIR.clone().multiplyScalar(272)}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial color={SPOT} transparent opacity={0.55} fog={false} />
      </mesh>
    </>
  );
}

// ── A printed field ─────────────────────────────────────────────────────────────
const FIELD_VS = /* glsl */ `
varying vec3 vWorld;
varying float vDist;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FIELD_FS = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec3 vWorld;
varying float vDist;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 p = vWorld.xz;
  // Patches of rougher ground printed as halftone dots.
  float n = noise(p * 0.06) * 0.6 + noise(p * 0.21) * 0.4;
  float shade = smoothstep(0.45, 0.85, n) * 0.55;
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 5.0;
  float d = length(fract(q) - 0.5);
  float r = sqrt(shade) * 0.6;
  float aa = fwidth(d);
  float dotInk = 1.0 - smoothstep(r - aa, r + aa, d);
  vec3 col = mix(uPaper * 0.97, uInk, dotInk * 0.45);
  // Tufts of grass: short upright strokes scattered in cells.
  vec2 cell = floor(p * 1.4);
  vec2 f = fract(p * 1.4) - 0.5;
  float h = hash(cell);
  float tuft = step(0.72, h) * (1.0 - smoothstep(0.0, 0.04, abs(f.x + (f.y + 0.5) * (h - 0.86)))) * step(abs(f.y), 0.32);
  float fade = exp(-vDist * 0.02);
  col = mix(col, uInk, tuft * 0.55 * fade);
  col = mix(col, uPaper, smoothstep(60.0, 220.0, vDist));
  gl_FragColor = vec4(col, 1.0);
}`;

/** A field printed in ink: halftone ground, grass tufts, fading into the haze. */
export function Field({ size = 600 }: { size?: number }) {
  const uniforms = useMemo(() => ({ uPaper: { value: new THREE.Color(PAPER) }, uInk: { value: new THREE.Color(INK) } }), []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <planeGeometry args={[size, size]} />
        <shaderMaterial vertexShader={FIELD_VS} fragmentShader={FIELD_FS} uniforms={uniforms} />
      </mesh>
      {/* Shadows fall on a transparent catcher just above the printed ground. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
    </>
  );
}

// ── Smoke and dust ──────────────────────────────────────────────────────────────
/** An ink-outlined puff, drawn once per variant: lobes lit from above, hatched below. */
function puffTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // A core with a ring of uneven lobes round it, so no two variants billow alike.
  const blobs: [number, number, number][] = [[128, 132, 58 + r() * 10]];
  const lobes = 6 + Math.floor(r() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + r() * 0.5;
    const d = 40 + r() * 20;
    blobs.push([128 + Math.cos(a) * d, 132 + Math.sin(a) * d * 0.85, 30 + r() * 20]);
  }
  g.fillStyle = "rgba(240,228,204,0.95)";
  for (const [x, y, rad] of blobs) {
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(90,60,34,0.75)";
  g.lineWidth = 4;
  g.lineCap = "round";
  for (const [x, y, rad] of blobs) {
    const from = Math.PI * (0.85 + r() * 0.2);
    g.beginPath();
    g.arc(x, y, rad, from, from + Math.PI * (0.9 + r() * 0.4));
    g.stroke();
  }
  // Rub the strokes back out where they fall inside a neighbouring lobe.
  g.save();
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(240,228,204,0.8)";
  for (const [x, y, rad] of blobs) {
    g.beginPath();
    g.arc(x, y, rad - 7, 0, Math.PI * 2);
    g.fill();
  }
  // Hatching in the shadowed underside.
  g.lineWidth = 1.5;
  g.strokeStyle = "rgba(90,60,34,0.35)";
  for (let x = 20; x < 240; x += 8 + r() * 3) {
    const len = 30 + r() * 30;
    g.beginPath();
    g.moveTo(x, 214 - r() * 8);
    g.lineTo(x + len * 0.66, 214 - len);
    g.stroke();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type BurstOptions = {
  /** Overall scale of the burst, roughly the metres it first fills. */
  size?: number;
  /** Which way it is thrown (need not be unit length). Straight up if omitted. */
  dir?: THREE.Vector3;
  /** How hard it is thrown, m/s. */
  speed?: number;
  /** How far puffs stray from `dir`: 0 is a jet, 1 a ball. */
  spread?: number;
  /** How many puffs. */
  count?: number;
  /** Smoke is hot and climbs; dust is heavy, hugs the ground and settles. */
  kind?: "smoke" | "dust";
};
export type SmokeHandle = {
  /** A burst of smoke at a point, or a single muzzle flash. */
  emit: (at: THREE.Vector3, size?: number, flash?: boolean) => void;
  /** A burst of smoke or dust thrown in a direction. */
  burst: (at: THREE.Vector3, options?: BurstOptions) => void;
};

const MAX_PUFFS = 96;
const VARIANTS = [11, 47, 83];
/** The air over the field is never quite still: puffs take this up as they slow. */
const WIND = new THREE.Vector3(0.55, 0, 0.28);
const UP = new THREE.Vector3(0, 1, 0);
const TINT = { smoke: new THREE.Color("#ffffff"), dust: new THREE.Color("#ecd8b0"), flash: new THREE.Color(SPOT) };
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Puff = {
  alive: boolean;
  flash: boolean;
  kind: "smoke" | "dust";
  age: number;
  life: number;
  r0: number;
  grow: number;
  drag: number;
  lift: number;
  rot: number;
  spin: number;
  phase: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
};

/**
 * A pool of smoke and dust puffs (and muzzle flashes); call it through the ref.
 *
 * Each puff is a small body in air. It is thrown out fast and air drag eats
 * that speed within a fraction of a second; as it stalls, buoyancy (smoke) or
 * a slow settling (dust) takes over and the breeze carries it off. All the
 * while it swells, quickly at first, and thins as it swells, since the same
 * dust is spread through more air. No two puffs share a size, drag or lifetime.
 */
export const Smoke = forwardRef<SmokeHandle>(function Smoke(_, ref) {
  const textures = useMemo(() => VARIANTS.map(puffTexture), []);
  const group = useRef<THREE.Group>(null);
  const state = useRef<Puff[]>(
    Array.from({ length: MAX_PUFFS }, () => ({
      alive: false, flash: false, kind: "smoke", age: 0, life: 1, r0: 1, grow: 1, drag: 1, lift: 0, rot: 0, spin: 0, phase: 0,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    })),
  );
  const next = useRef(0);
  const tmp = useRef(new THREE.Vector3());
  // With reduced motion a burst is one calm puff that swells and fades in place.
  const calm = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useImperativeHandle(ref, () => {
    const take = () => {
      const p = state.current[next.current];
      next.current = (next.current + 1) % MAX_PUFFS;
      p.alive = true;
      return p;
    };
    const burst: SmokeHandle["burst"] = (at, o = {}) => {
      const size = o.size ?? 1;
      const kind = o.kind ?? "smoke";
      const spread = o.spread ?? 0.7;
      const speed = calm ? 0 : (o.speed ?? (kind === "dust" ? 2.2 : 3)) * Math.sqrt(size);
      const count = calm ? 1 : (o.count ?? Math.round(3 + Math.min(4, size)));
      const dir = tmp.current.copy(o.dir ?? UP).normalize();
      for (let i = 0; i < count; i++) {
        const p = take();
        p.flash = false;
        p.kind = kind;
        // Staggered a few frames apart, so a burst unrolls rather than pops.
        p.age = calm ? 0 : -Math.random() * 0.14;
        p.r0 = size * (0.24 + Math.random() * 0.26);
        p.grow = 0.8 + Math.random() * 0.9;
        p.life = Math.min(7, (kind === "dust" ? 2.1 : 2.9) * (0.7 + Math.random() * 0.7) * (0.75 + 0.25 * Math.sqrt(size)));
        // Small puffs are stopped by the air sooner than big ones.
        p.drag = (2.0 + Math.random() * 1.8) / Math.sqrt(Math.max(0.5, size * 0.6));
        p.lift = (kind === "dust" ? 0.18 + Math.random() * 0.3 : 0.7 + Math.random() * 0.8) * Math.sqrt(size);
        p.rot = (Math.random() - 0.5) * 0.9;
        p.spin = calm ? 0 : (Math.random() - 0.5) * 1.4;
        p.phase = Math.random() * 100;
        p.pos.set(at.x + (Math.random() - 0.5) * size * 0.35, at.y + (Math.random() - 0.5) * size * 0.2, at.z + (Math.random() - 0.5) * size * 0.35);
        // Thrown along `dir`, scattered round it; dust is scattered flat along the ground.
        p.vel.set(Math.random() - 0.5, (Math.random() - 0.5) * (kind === "dust" ? 0.5 : 1), Math.random() - 0.5)
          .multiplyScalar(2 * spread)
          .add(dir)
          .multiplyScalar(speed * (0.35 + Math.random() * 0.9));
      }
    };
    return {
      burst,
      emit(at, size = 1, flash = false) {
        if (!flash) return burst(at, { size });
        const p = take();
        p.flash = true;
        p.age = 0;
        p.life = 0.18;
        p.r0 = size;
        p.rot = Math.random() * Math.PI;
        p.pos.copy(at);
      },
    };
  }, [calm]);

  useFrame((_, dtIn) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(dtIn, 1 / 20);
    state.current.forEach((p, i) => {
      const sprite = g.children[i] as THREE.Sprite;
      if (!p.alive) {
        sprite.visible = false;
        return;
      }
      p.age += dt;
      if (p.age > p.life) {
        p.alive = false;
        sprite.visible = false;
        return;
      }
      if (p.age < 0) {
        sprite.visible = false;
        return;
      }
      const m = sprite.material as THREE.SpriteMaterial;
      sprite.visible = true;
      const k = p.age / p.life;
      if (p.flash) {
        sprite.position.copy(p.pos);
        sprite.scale.setScalar(p.r0 * (0.8 + k));
        m.opacity = 1 - k;
        m.rotation = p.rot;
        m.color.copy(TINT.flash);
        return;
      }
      // Drag: the throw decays exponentially, fast then slow.
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      // As it stalls, what the air does to it takes over: rise, drift, and a slow curl.
      const stalled = 1 - Math.exp(-p.age * 1.6);
      const settle = p.kind === "dust" ? 1 - 1.5 * smooth(0.45, 1, k) : 1;
      const curl = 0.32 * stalled * Math.sqrt(p.r0);
      p.pos.x += (p.vel.x + WIND.x * stalled + Math.sin(p.phase + p.age * 1.3) * curl) * dt;
      p.pos.y += (p.vel.y + p.lift * stalled * settle + Math.sin(p.phase * 1.9 + p.age * 1.7) * curl * 0.4) * dt;
      p.pos.z += (p.vel.z + WIND.z * stalled + Math.cos(p.phase * 1.3 + p.age * 1.1) * curl) * dt;
      // It swells quickly as it bursts, then goes on spreading slowly.
      const r = p.r0 * (1 + p.grow * (1 - Math.exp(-p.age * 2.6)) + 0.14 * p.age);
      // The ground is in the way: a puff rolls out along it instead of sinking in.
      const floor = r * 0.3;
      if (p.pos.y < floor) {
        p.pos.y = floor;
        if (p.vel.y < 0) p.vel.y *= -0.15;
      }
      p.spin *= Math.exp(-dt * 0.9);
      p.rot += p.spin * dt;
      sprite.position.copy(p.pos);
      sprite.scale.setScalar(r * 2.1);
      // The same dust in more air: thinner as it swells, then gone.
      const thin = 0.45 + 0.55 * (p.r0 / r) * (1 + p.grow * 0.5);
      m.opacity = smooth(0, 0.1, p.age) * (1 - smooth(0.4, 1, k)) * Math.min(1, thin) * (p.kind === "dust" ? 0.62 : 0.9);
      m.rotation = p.rot;
      m.color.copy(TINT[p.kind]);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: MAX_PUFFS }, (_, i) => (
        <sprite key={i} visible={false}>
          <spriteMaterial map={textures[i % textures.length]} transparent depthWrite={false} fog />
        </sprite>
      ))}
    </group>
  );
});
