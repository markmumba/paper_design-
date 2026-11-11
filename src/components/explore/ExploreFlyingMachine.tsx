"use client";

import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { sound } from "@/lib/sound";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "./ExploreRoom";
import { createFlight, stepFlight } from "./flight";
import { INK, PAPER, SPOT } from "./kit";
import { OVERVIEW, PARTS, Ornithopter3D } from "./OrnithopterModel";
import { Cloud, Coastline } from "./scenery";

/*
 * Folio I in three dimensions.
 *
 *  Anatomia: the machine on a drafting table. Hover a part to ink it in red,
 *  click it (or pick it from the list) and the camera glides in to magnify it
 *  while the rest of the machine fades back; read what it was for.
 *
 *  In volo: the machine flying over an inked sea in Leonardo's manner of
 *  drawing water. Choose to watch from the side, above, below, behind or in
 *  front, or take the camera yourself and orbit it as it flies.
 */

const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "Side", offset: [9.5, 1.4, 0.5] },
  { id: "sopra", it: "Di sopra", en: "Above", offset: [0.01, 11, -2.5] },
  { id: "sotto", it: "Di sotto", en: "Below", offset: [0.5, -5.2, 1.8] },
  { id: "dietro", it: "Di dietro", en: "Behind", offset: [0, 2.6, -9.5] },
  { id: "fronte", it: "Di fronte", en: "Front", offset: [1.2, 1.4, 9] },
  { id: "libera", it: "Libera", en: "Free", offset: [7, 3, -6] },
];

// ── In volo ─────────────────────────────────────────────────────────────────
// ── The sea ─────────────────────────────────────────────────────────────────
/*
 * Gerstner (trochoidal) waves: water particles move in circles, so crests
 * come out sharp and troughs broad, the true profile of sea waves rather than
 * sine bumps. Five swells with deep-water speeds c = √(g/k). The surface
 * normal and a "folding" measure come out of the same sums: where the surface
 * folds, waves are breaking and foam is drawn.
 */
const SUN_DIR = new THREE.Vector3(-160, 46, -220).normalize();
// [wavelength m, amplitude m, direction rad, sharpness (Q·k·A)]
const WAVES: [number, number, number, number][] = [
  [42, 0.62, 0.25, 0.2],
  [23, 0.33, -0.45, 0.2],
  [13, 0.17, 1.05, 0.18],
  [7.5, 0.08, -1.3, 0.16],
  [4.2, 0.035, 0.6, 0.14],
];
const AMP_SUM = WAVES.reduce((a, w) => a + w[1], 0);
const waveGlsl = WAVES.map(
  ([L, A, d, s]) => `W(p, vec2(${Math.cos(d).toFixed(4)}, ${Math.sin(d).toFixed(4)}), ${L.toFixed(2)}, ${A.toFixed(3)}, ${s.toFixed(3)}, disp, nrm, fold);`,
).join("\n  ");

/** Height of the sea at (x, z): the same swells, for floating the boats. */
export function seaHeight(x: number, z: number, t: number) {
  let h = 0;
  for (const [L, A, d] of WAVES) {
    const k = (Math.PI * 2) / L;
    const c = Math.sqrt(9.81 / k);
    h += A * Math.sin(k * (Math.cos(d) * x + Math.sin(d) * z - c * t));
  }
  return h;
}

const OCEAN_VS = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFold;
varying float vCrest;
varying float vPhase;
varying float vDist;
void W(vec2 p, vec2 d, float L, float A, float s, inout vec3 disp, inout vec3 nrm, inout float fold) {
  float k = 6.2831853 / L;
  float c = sqrt(9.81 / k);
  float f = k * (dot(d, p) - c * uTime);
  float q = s / (k * A);
  disp += vec3(q * A * d.x * cos(f), A * sin(f), q * A * d.y * cos(f));
  nrm += vec3(-d.x * k * A * cos(f), -s * sin(f), -d.y * k * A * cos(f));
  fold -= s * sin(f);
}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 p = world.xz;
  vec3 disp = vec3(0.0);
  vec3 nrm = vec3(0.0, 1.0, 0.0);
  float fold = 1.0;
  ${waveGlsl}
  world.xyz += disp;
  vNormal = normalize(nrm);
  vFold = fold;
  vCrest = disp.y / ${AMP_SUM.toFixed(3)};
  // Phase of the main swell, used to draw ink lines along its crests.
  float k0 = 6.2831853 / ${WAVES[0][0].toFixed(2)};
  vPhase = (k0 * (dot(vec2(${Math.cos(WAVES[0][2]).toFixed(4)}, ${Math.sin(WAVES[0][2]).toFixed(4)}), p) - sqrt(9.81 / k0) * uTime)) / 6.2831853;
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const OCEAN_FS = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uSpot;
uniform vec3 uSun;
uniform vec2 uShadow;
uniform float uShadowR;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vFold;
varying float vCrest;
varying float vPhase;
varying float vDist;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSun);
  // Light on water: soft diffuse plus the pale sky reflected at grazing angles.
  float diff = dot(N, L) * 0.5 + 0.5;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  float light = mix(0.5, 1.0, diff) * (1.0 - 0.3 * fres) + 0.45 * fres;

  // Riso halftone: shadowed water printed as ink dots, like the machine.
  float shade = clamp(1.04 - light, 0.0, 1.0);
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 5.0;
  float dd = length(fract(q) - 0.5);
  float r = sqrt(shade) * 0.66;
  float aa = fwidth(dd);
  float dotInk = 1.0 - smoothstep(r - aa, r + aa, dd);
  vec3 col = mix(uPaper * 0.965, uInk, dotInk * 0.5);

  float fade = exp(-vDist * 0.011);
  // Pen strokes along the main swell's crests, only where the water stands high.
  float ph = vPhase * 2.0 + vCrest * 0.6;
  float iso = abs(fract(ph) - 0.5);
  float w = fwidth(ph);
  float crestLine = (1.0 - smoothstep(0.0, w * 1.6, 0.5 - iso)) * smoothstep(0.05, 0.55, vCrest);
  col = mix(col, uInk, crestLine * 0.65 * fade);

  // Foam where the surface folds over: short white strokes scratched in.
  float foam = smoothstep(0.62, 0.3, vFold) * smoothstep(0.1, 0.5, vCrest);
  float strokes = step(0.5, fract((gl_FragCoord.x * 0.8 + gl_FragCoord.y) / 4.5));
  col = mix(col, uPaper * 1.06, foam * strokes * 0.9 * fade);

  // The glitter path under the low sun, flecked in the spot colour.
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 260.0);
  col = mix(col, uSpot, smoothstep(0.18, 0.55, spec) * 0.9);

  // The machine's shadow on the water.
  float sd = length(vWorld.xz - uShadow) / uShadowR;
  col = mix(col, uInk, (1.0 - smoothstep(0.5, 1.0, sd)) * 0.22);
  // Haze into the paper towards the horizon.
  col = mix(col, uPaper, smoothstep(70.0, 250.0, vDist));
  gl_FragColor = vec4(col, 1.0);
}`;

function Ocean({ shadow }: { shadow: RefObject<{ x: number; z: number; r: number }> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPaper: { value: new THREE.Color(PAPER) },
      uInk: { value: new THREE.Color(INK) },
      uSpot: { value: new THREE.Color(SPOT) },
      uSun: { value: SUN_DIR.clone() },
      uShadow: { value: new THREE.Vector2() },
      uShadowR: { value: 3 },
    }),
    [],
  );
  useFrame(({ clock, camera }) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value = clock.elapsedTime;
    const s = shadow.current;
    if (s) {
      (m.uniforms.uShadow.value as THREE.Vector2).set(s.x, s.z);
      m.uniforms.uShadowR.value = s.r;
    }
    // The sea travels with the camera (snapped to the grid), so it never ends.
    // Waves are computed in world space, so the pattern does not slide.
    if (mesh.current) mesh.current.position.set(Math.round(camera.position.x / 4) * 4, 0, Math.round(camera.position.z / 4) * 4);
  });
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(560, 560, 320, 320);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <mesh ref={mesh} geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={OCEAN_VS} fragmentShader={OCEAN_FS} uniforms={uniforms} />
    </mesh>
  );
}

/** Small sailing boats riding the swell, sails in paper and one in the spot colour. */
const BOATS: { x: number; z: number; heading: number; spot: boolean; drift: number }[] = [
  { x: -38, z: -55, heading: 0.6, spot: true, drift: 0.6 },
  { x: 60, z: -30, heading: 2.2, spot: false, drift: 0.5 },
  { x: 25, z: 70, heading: -1.1, spot: false, drift: 0.7 },
  { x: -75, z: 30, heading: 1.4, spot: false, drift: 0.55 },
];

function Boat({ x, z, heading, spot, drift }: (typeof BOATS)[number]) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const hull = new THREE.Shape();
    hull.moveTo(-1.6, 0);
    hull.quadraticCurveTo(-1.2, -0.65, 0, -0.7);
    hull.quadraticCurveTo(1.3, -0.65, 2.0, 0.15);
    hull.lineTo(-1.6, 0);
    const h = new THREE.ExtrudeGeometry(hull, { depth: 0.9, bevelEnabled: false });
    h.translate(0, 0, -0.45);
    const sail = new THREE.Shape();
    sail.moveTo(0, 0.3);
    sail.lineTo(0, 3.4);
    sail.lineTo(1.7, 0.4);
    sail.lineTo(0, 0.3);
    return { hull: h, sail: new THREE.ShapeGeometry(sail) };
  }, []);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const px = x + Math.sin(heading) * drift * t;
    const pz = z + Math.cos(heading) * drift * t;
    // Ride the same swells as the shader, pitching and rolling on the slope.
    const h = seaHeight(px, pz, t);
    const hx = seaHeight(px + 1.5, pz, t) - seaHeight(px - 1.5, pz, t);
    const hz = seaHeight(px, pz + 1.5, t) - seaHeight(px, pz - 1.5, t);
    g.position.set(px, h + 0.25, pz);
    g.rotation.set(Math.atan2(hz, 3) * 0.8, heading - Math.PI / 2, -Math.atan2(hx, 3) * 0.8, "YXZ");
  });
  return (
    <group ref={ref}>
      <mesh geometry={geo.hull}>
        <meshStandardMaterial color="#8a6440" roughness={0.9} />
        <Edges color={INK} lineWidth={1.2} />
      </mesh>
      <mesh position={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3.6, 5]} />
        <meshStandardMaterial color="#5d4028" />
      </mesh>
      <mesh geometry={geo.sail} position={[0.12, 0, 0]}>
        <meshStandardMaterial color={spot ? SPOT : "#f1e4c6"} side={THREE.DoubleSide} roughness={0.95} />
        <Edges color={INK} lineWidth={1.4} threshold={10} />
      </mesh>
    </group>
  );
}

/** Gulls: quick ink V-strokes wheeling over the water. */
const GULLS = (() => {
  let seed = 41;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 12 }, (_, i) => ({
    r: 14 + r() * 40,
    h: 4 + r() * 10,
    speed: 0.08 + r() * 0.1,
    ph: r() * Math.PI * 2,
    flap: 5 + r() * 3,
    dir: i % 3 ? 1 : -1,
  }));
})();

function Gulls() {
  const ref = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(GULLS.length * 4 * 3), []);
  useFrame(({ clock }) => {
    const line = ref.current;
    if (!line) return;
    const t = clock.elapsedTime;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    GULLS.forEach((b, i) => {
      const a = b.ph + t * b.speed * b.dir;
      const x = Math.cos(a) * b.r;
      const z = Math.sin(a) * b.r;
      const y = b.h + Math.sin(t * 0.5 + i) * 0.8;
      const tx = -Math.sin(a) * b.dir;
      const tz = Math.cos(a) * b.dir;
      // Wings perpendicular to the direction of travel.
      const wx = -tz * 0.6;
      const wz = tx * 0.6;
      const up = Math.sin(t * b.flap + i) * 0.35;
      pos.setXYZ(i * 4, x, y, z);
      pos.setXYZ(i * 4 + 1, x + wx, y + up, z + wz);
      pos.setXYZ(i * 4 + 2, x, y, z);
      pos.setXYZ(i * 4 + 3, x - wx, y + up, z - wz);
    });
    pos.needsUpdate = true;
  });
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={INK} />
    </lineSegments>
  );
}

/** Ink trails streaming off both wingtips, fading into the paper. */
const TRAIL = 90;
function makeTrail() {
  const geo = new THREE.BufferGeometry();
  const colors = new Float32Array(TRAIL * 3);
  const ink = new THREE.Color(INK);
  const paper = new THREE.Color(PAPER);
  for (let i = 0; i < TRAIL; i++) {
    const c = ink.clone().lerp(paper, Math.pow(i / (TRAIL - 1), 0.7));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true }));
  line.frustumCulled = false;
  return line;
}

function TipTrails({ machine, flap }: { machine: RefObject<THREE.Group | null>; flap: RefObject<number> }) {
  const right = useRef<THREE.Line>(null);
  const left = useRef<THREE.Line>(null);
  const lines = useMemo(() => [makeTrail(), makeTrail()], []);
  const filled = useRef([false, false]);
  const tip = useRef(new THREE.Vector3());
  useFrame(() => {
    const g = machine.current;
    if (!g) return;
    const a = flap.current ?? 0;
    [right.current, left.current].forEach((line, k) => {
      if (!line) return;
      const side = k === 0 ? 1 : -1;
      // Wingtip in the model frame after the hinge rotation, then into the world.
      const t = tip.current.set(side * (0.6 + 3.0 * Math.cos(a)), 3.0 * Math.sin(a), 0.1);
      g.localToWorld(t);
      const pos = line.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      if (!filled.current[k]) {
        for (let i = 0; i < TRAIL; i++) arr.set([t.x, t.y, t.z], i * 3);
        filled.current[k] = true;
      }
      arr.copyWithin(3, 0, (TRAIL - 1) * 3);
      arr.set([t.x, t.y, t.z], 0);
      pos.needsUpdate = true;
    });
  });
  return (
    <>
      <primitive ref={right} object={lines[0]} />
      <primitive ref={left} object={lines[1]} />
    </>
  );
}

function FlightScene({ view }: { view: string }) {
  const machine = useRef<THREE.Group>(null);
  const flap = useRef(0);
  const shadow = useRef({ x: 0, z: 0, r: 3 });
  const gulls = useRef<THREE.Group>(null);
  const flight = useRef(createFlight());
  const subject = useRef<Subject>({ pos: new THREE.Vector3(18, 7, 0), yaw: 0, look: new THREE.Vector3() });
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const g = machine.current;
    if (!g) return;
    const f = flight.current;
    if (stepFlight(f, dt)) sound.flap(0.6);
    flap.current = f.angle;
    g.position.copy(f.pos);
    g.rotation.set(f.pitch, f.yaw, f.bank, "YXZ");
    shadow.current = { x: f.pos.x, z: f.pos.z, r: 2.2 + f.pos.y * 0.12 };
    // The gulls keep company, loosely.
    gulls.current?.position.lerp(tmp.current.set(f.pos.x, 0, f.pos.z), 1 - Math.exp(-dt * 0.3));
    // The camera looks slightly ahead of the machine, as an operator would.
    const s = subject.current;
    s.pos.copy(f.pos);
    s.yaw = f.yaw;
    s.look!.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)).multiplyScalar(1.5).add(f.pos);
  });

  return (
    <>
      <color attach="background" args={[PAPER]} />
      <fog attach="fog" args={[PAPER, 60, 260]} />
      <hemisphereLight args={["#fff4dc", "#d2b88a", 1.2]} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(100)} intensity={1.5} color="#fff1d6" />
      {/* A riso sun: a disc in the spot colour, low over the horizon. */}
      <mesh position={SUN_DIR.clone().multiplyScalar(272)}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial color={SPOT} transparent opacity={0.55} fog={false} />
      </mesh>
      <Coastline />
      <Ocean shadow={shadow} />
      {BOATS.map((b, i) => (
        <Boat key={i} {...b} />
      ))}
      <group ref={gulls}>
        <Gulls />
      </group>
      {[
        [-40, 28, -70, 34, 3],
        [30, 34, -110, 46, 11],
        [90, 26, -40, 30, 29],
        [-90, 30, 30, 38, 7],
        [20, 38, 90, 42, 17],
      ].map(([x, y, z, s, seed], i) => (
        <Cloud key={i} position={[x, y, z]} scale={s} seed={seed} />
      ))}
      <group ref={machine}>
        <Ornithopter3D drive={flap} />
      </group>
      <TipTrails machine={machine} flap={flap} />
      <FollowCamera subject={subject} view={view} views={VIEWS} maxDistance={40} />
    </>
  );
}

// ── The room ────────────────────────────────────────────────────────────────
const CONFIG: RoomConfig = {
  folio: "I",
  title: "Macchina volante",
  ariaLabel: "The flying machine in three dimensions",
  parts: PARTS,
  overview: OVERVIEW,
  Model: Ornithopter3D,
  rest: 0.14,
  animate: (t) => 0.14 + 0.38 * Math.sin(t * 1.7),
  // A wingbeat as the wings turn over at the top of their swing and start down.
  voice: (a, was, before) => {
    if (was > before && a <= was) sound.flap(0.5);
  },
  play: ["batti le ali", "flap"],
  action: { label: "In volo", Scene: FlightScene, views: VIEWS, start: [10, 9, 0] },
};

export default function ExploreFlyingMachine({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
