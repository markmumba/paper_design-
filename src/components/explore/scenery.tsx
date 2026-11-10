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

// ── Smoke ───────────────────────────────────────────────────────────────────
/** An ink-outlined puff of smoke, drawn once. */
function puffTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const blobs = [
    [128, 140, 70],
    [84, 120, 46],
    [172, 116, 50],
    [128, 84, 44],
    [96, 170, 38],
    [166, 168, 40],
  ];
  g.fillStyle = "rgba(240,228,204,0.95)";
  for (const [x, y, r] of blobs) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(90,60,34,0.75)";
  g.lineWidth = 4;
  for (const [x, y, r] of blobs) {
    g.beginPath();
    g.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1);
    g.stroke();
  }
  g.lineWidth = 1.5;
  g.strokeStyle = "rgba(90,60,34,0.35)";
  for (let x = 30; x < 240; x += 9) {
    g.beginPath();
    g.moveTo(x, 210);
    g.lineTo(x + 40, 150);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type SmokeHandle = { emit: (at: THREE.Vector3, size?: number, flash?: boolean) => void };
const MAX_PUFFS = 40;

/** A pool of smoke puffs (and muzzle flashes); call emit() through the ref. */
export const Smoke = forwardRef<SmokeHandle>(function Smoke(_, ref) {
  const tex = useMemo(() => puffTexture(), []);
  const group = useRef<THREE.Group>(null);
  const state = useRef(Array.from({ length: MAX_PUFFS }, () => ({ alive: false, age: 0, size: 1, flash: false, pos: new THREE.Vector3(), vel: new THREE.Vector3() })));
  const next = useRef(0);
  useImperativeHandle(ref, () => ({
    emit(at, size = 1, flash = false) {
      const p = state.current[next.current];
      next.current = (next.current + 1) % MAX_PUFFS;
      p.alive = true;
      p.age = 0;
      p.size = size;
      p.flash = flash;
      p.pos.copy(at);
      p.vel.set((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6);
    },
  }));
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    state.current.forEach((p, i) => {
      const sprite = g.children[i] as THREE.Sprite;
      if (!p.alive) {
        sprite.visible = false;
        return;
      }
      p.age += dt;
      const life = p.flash ? 0.18 : 3.2;
      if (p.age > life) {
        p.alive = false;
        sprite.visible = false;
        return;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 0.6);
      const k = p.age / life;
      sprite.visible = true;
      sprite.position.copy(p.pos);
      const s = p.size * (p.flash ? 0.8 + k : 0.6 + Math.sqrt(k) * 2.2);
      sprite.scale.set(s, s, 1);
      const m = sprite.material as THREE.SpriteMaterial;
      m.opacity = p.flash ? 1 - k : (1 - k) * 0.95;
      m.color.set(p.flash ? SPOT : "#ffffff");
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: MAX_PUFFS }, (_, i) => (
        <sprite key={i} visible={false}>
          <spriteMaterial map={tex} transparent depthWrite={false} fog />
        </sprite>
      ))}
    </group>
  );
});
