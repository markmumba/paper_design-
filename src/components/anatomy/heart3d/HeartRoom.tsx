"use client";

import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "@/components/explore/ExploreRoom";
import { INK, PAPER, Part, SPOT, type Drive, type PartDef, type Vec3 } from "@/components/explore/kit";
import { Bone, Drift, useBones, type Manifest, type MeshInfo } from "../bones3d";
import data from "./manifest.json";

/*
 * Folio IV in three dimensions: the heart, and the valve Leonardo watched.
 *
 * The heart is a modern anatomical model (BodyParts3D, see ../bones3d), in its
 * parts: the muscular wall, the valves inside it, the aorta, the vein that
 * brings blood back, the heart's own arteries, and the muscles that hold the
 * valves. Play it and it beats; open it and the wall lifts away from the
 * valves.
 *
 * The model has no aortic valve, the very one he studied. So the action scene
 * is a model of our own, in glass, as he watched one: the root of the aorta
 * with its three pouches and three cusps. Blood rises through the open
 * valve, curls into eddies in the pouches, and the cusps shut.
 */

const manifest: Manifest = data;
const URL = "/anatomy/heart.bin";
export const HEART_CREDIT = "A modern anatomical model, not Leonardo’s: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan. The glass valve is ours.";

type Region = "parete" | "valvole" | "aorta" | "vene" | "coronarie" | "papillari";
const has = (m: MeshInfo, ...w: string[]) => w.some((x) => m.name.includes(x));
function regionOf(m: MeshInfo): Region {
  if (has(m, "wall of heart")) return "parete";
  if (has(m, "valve")) return "valvole";
  if (has(m, "aorta")) return "aorta";
  if (has(m, "vena cava", "coronary sinus")) return "vene";
  if (has(m, "papillary")) return "papillari";
  return "coronarie";
}
const COLOR: Record<Region, string> = {
  parete: "#d9a387",
  valvole: "#f1dfbf",
  aorta: "#d6a58c",
  vene: "#c9b6a6",
  coronarie: "#c9735c",
  papillari: "#d39a80",
};

// Centre the heart itself, not its vessels.
const WALL = manifest.meshes.find((m) => m.name === "wall of heart")!;
const SHIFT: Vec3 = [-WALL.c[0], -WALL.c[1] + 0.25, -WALL.c[2]];

type Group = { id: Region; italian: string; english: string; text: string; out: Vec3 };
const GROUPS: Group[] = [
  {
    id: "parete",
    italian: "La parete",
    english: "The wall",
    text: "The heart is a muscle, its four chambers walled in it: two atria above that receive the blood, two ventricles below that drive it out. The left ventricle’s wall is the thickest, since it pumps to the whole body.",
    out: [0, 0.2, -1.6],
  },
  {
    id: "valvole",
    italian: "Le valvole",
    english: "The valves",
    text: "Four valves keep the blood moving one way. This model has three: the mitral, the tricuspid and the pulmonary. The fourth, the aortic valve Leonardo studied, is missing from it; the glass model shows it instead.",
    out: [0, 0.1, 1.1],
  },
  {
    id: "aorta",
    italian: "L’aorta",
    english: "The aorta",
    text: "The body’s largest artery, rising from the left ventricle and arching over towards the spine. Its root, just above the valve, swells into the three pouches where Leonardo drew his eddies.",
    out: [0, 1.2, 0.2],
  },
  {
    id: "coronarie",
    italian: "Le coronarie",
    english: "The heart’s own arteries",
    text: "The heart feeds itself first. Its two coronary arteries leave the aorta from those same pouches behind the valve and branch over its surface.",
    out: [0.9, -0.2, 0.9],
  },
  {
    id: "papillari",
    italian: "I muscoli papillari",
    english: "The papillary muscles",
    text: "Small muscles inside the ventricles. Fine cords run from them to the mitral and tricuspid valves and hold the cusps, so they shut without blowing back.",
    out: [0, -1.0, 0.8],
  },
  {
    id: "vene",
    italian: "Le vene",
    english: "The veins",
    text: "The superior vena cava returns blood from the head and arms to the right atrium; the coronary sinus gathers the heart’s own used blood.",
    out: [-1.0, 0.6, 0],
  },
];

const ALL = manifest.meshes.map((m) => ({ m, region: regionOf(m) }));
const centre = (r: Region): Vec3 => {
  const ms = ALL.filter((a) => a.region === r).map((a) => a.m);
  const c = ms.reduce<Vec3>((s, m) => [s[0] + m.c[0], s[1] + m.c[1], s[2] + m.c[2]], [0, 0, 0]);
  return [c[0] / ms.length + SHIFT[0], c[1] / ms.length + SHIFT[1], c[2] / ms.length + SHIFT[2]];
};

const PARTS: PartDef[] = GROUPS.map((g) => {
  const at = centre(g.id);
  return {
    id: g.id,
    italian: g.italian,
    english: g.english,
    text: g.text,
    target: at,
    camera: [at[0] + 2.2, at[1] + 0.8, at[2] + 3.2],
    follow: g.out,
    label: [at[0] + 0.7, at[1] + 0.2, at[2] + 0.4],
  };
});

/** The heartbeat: a quick squeeze of the whole heart, then a slower release. */
function Beat({ drive, children }: { drive: Drive; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = 1 - 0.045 * drive.current;
    ref.current?.scale.set(s, s, s);
  });
  return <group ref={ref}>{children}</group>;
}

function HeartModel({ drive }: { drive: Drive }) {
  const bones = useBones(URL, manifest);
  if (!bones) return null;
  return (
    <Beat drive={drive}>
      <group position={SHIFT}>
        {GROUPS.map((g) => {
          const def = PARTS.find((p) => p.id === g.id)!;
          const ms = ALL.filter((a) => a.region === g.id);
          return (
            <Part key={g.id} id={g.id} labelled={false}>
              {ms.map((a, i) => (
                <Drift
                  key={a.m.fma}
                  by={g.out}
                  labelFor={i === 0 ? { id: g.id, at: [def.label[0] - SHIFT[0], def.label[1] - SHIFT[1], def.label[2] - SHIFT[2]] } : undefined}
                >
                  <Bone geo={bones.get(a.m.fma)!} color={COLOR[g.id]} />
                </Drift>
              ))}
            </Part>
          );
        })}
      </group>
    </Beat>
  );
}

// ── Il modello di vetro: the valve in glass ──────────────────────────────────
const R0 = 0.62; // radius of the aorta
const SINUS_Y = 0.12; // height of the pouches' fullest point
/** Fullness of the pouches: three lobes, swelling just above the valve. */
const lobe = (th: number, y: number) => Math.max(0, Math.cos(3 * th)) ** 1.5 * Math.exp(-(((y - SINUS_Y) / 0.42) ** 2)) * 0.42;
const wallR = (th: number, y: number) => R0 * (1 + lobe(th, y));

function rootGeometry() {
  const NT = 96;
  const NY = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= NY; j++) {
    const y = -1.3 + (2.9 * j) / NY;
    for (let i = 0; i <= NT; i++) {
      const th = (i / NT) * Math.PI * 2;
      const r = wallR(th, y);
      pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
    }
  }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NT; i++) {
      const a = j * (NT + 1) + i;
      const b = a + NT + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Valve state over one beat: 1 open (blood out), 0 shut. Period 1.4 s. */
const BEAT = 1.4;
function openness(t: number) {
  const u = (t % BEAT) / BEAT;
  if (u < 0.08) return u / 0.08;
  if (u < 0.34) return 1;
  if (u < 0.42) return 1 - (u - 0.34) / 0.08;
  return 0;
}

const CU = 18; // across a cusp
const CV = 10; // from its hinge to its free edge
/** Write the three cusps into `pos` for an openness `o`. */
function writeCusps(pos: Float32Array, o: number) {
  let n = 0;
  for (let k = 0; k < 3; k++) {
    const mid = (k * 2 * Math.PI) / 3; // each cusp faces a pouch
    for (let i = 0; i <= CU; i++) {
      const u = i / CU;
      const th = mid - Math.PI / 3 + (u * 2 * Math.PI) / 3;
      // The hinge dips in a U along the wall, lowest under the middle of the pouch.
      const hy = -0.35 - 0.25 * Math.sin(Math.PI * u);
      const hr = wallR(th, hy) * 0.98;
      // Free edge: open, pressed back towards the pouch; shut, a straight line to the centre.
      const fy = SINUS_Y - 0.02;
      const openR = wallR(th, fy) * 0.82;
      const shutR = R0 * Math.abs(1 - 2 * u) * 0.98;
      const fr = shutR + (openR - shutR) * o;
      for (let j = 0; j <= CV; j++) {
        const v = j / CV;
        // Shut, the cusp bellies down like a pocket; open, it lies back flat.
        const sag = (1 - o) * 0.22 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u);
        const r = hr + (fr - hr) * v;
        const y = hy + (fy - hy) * v - sag;
        pos[n++] = Math.cos(th) * r;
        pos[n++] = y;
        pos[n++] = Math.sin(th) * r;
      }
    }
  }
}

function cuspGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(3 * (CU + 1) * (CV + 1) * 3);
  writeCusps(pos, 0);
  const idx: number[] = [];
  for (let k = 0; k < 3; k++) {
    const base = k * (CU + 1) * (CV + 1);
    for (let i = 0; i < CU; i++)
      for (let j = 0; j < CV; j++) {
        const a = base + i * (CV + 1) + j;
        const b = a + CV + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Blood: most of it streams up the middle while the valve is open; some is caught in each pouch and turns there. */
const N = 900;
type Drop = { swirl: number; k: number; a: number; r: number; x: number; z: number; y: number; speed: number };
function makeDrops(): Drop[] {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: N }, (_, i) => ({
    swirl: i % 3 === 0 ? 1 : 0,
    k: i % 3,
    a: rnd() * Math.PI * 2,
    r: 0.04 + rnd() * 0.16,
    x: (rnd() - 0.5) * 0.9,
    z: (rnd() - 0.5) * 0.9,
    y: -1.3 + rnd() * 2.9,
    speed: 0.7 + rnd() * 0.6,
  }));
}

function GlassValve() {
  const root = useMemo(() => rootGeometry(), []);
  const cusps = useMemo(() => cuspGeometry(), []);
  const drops = useMemo(() => makeDrops(), []);
  const points = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: SPOT, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false }));
    p.frustumCulled = false;
    return p;
  }, []);
  const cuspRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const swirl = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const o = openness(t);
    const cm = cuspRef.current;
    if (cm) {
      const attr = cm.geometry.attributes.position as THREE.BufferAttribute;
      writeCusps(attr.array as Float32Array, o);
      attr.needsUpdate = true;
      cm.geometry.computeVertexNormals();
    }
    // The eddies spin up while blood rushes past the pouches, and slowly die away.
    swirl.current += (o * 3.2 - swirl.current) * Math.min(1, dt * (o > 0.5 ? 3 : 0.8));
    const pp = pointsRef.current;
    if (!pp) return;
    const arr = (pp.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    drops.forEach((d, i) => {
      if (d.swirl) {
        // Round and round in the pouch's own upright plane.
        d.a += dt * swirl.current * d.speed * 1.6;
        const mid = (d.k * 2 * Math.PI) / 3;
        const cr = R0 * 1.12;
        const rr = cr + Math.cos(d.a) * d.r;
        arr[i * 3] = Math.cos(mid) * rr;
        arr[i * 3 + 1] = SINUS_Y + Math.sin(d.a) * d.r * 1.3;
        arr[i * 3 + 2] = Math.sin(mid) * rr;
      } else {
        // Up through the opening while the valve is open; held still while it is shut.
        d.y += dt * o * 2.4 * d.speed;
        if (d.y > 1.6) d.y -= 2.9;
        const pinch = d.y < 0 ? 0.55 + 0.45 * o : 1;
        arr[i * 3] = d.x * pinch * 0.9;
        arr[i * 3 + 1] = d.y;
        arr[i * 3 + 2] = d.z * pinch * 0.9;
      }
    });
    (pp.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  // Turned so the two front pouches show their eddies nearly face-on.
  return (
    <group rotation={[0, -Math.PI / 6, 0]}>
      <mesh geometry={root} renderOrder={2}>
        <meshStandardMaterial color="#cfe0dc" transparent opacity={0.16} roughness={0.15} metalness={0} side={THREE.DoubleSide} depthWrite={false} />
        <Edges threshold={14} color={INK} lineWidth={1} transparent opacity={0.55} />
      </mesh>
      <mesh ref={cuspRef} geometry={cusps}>
        <meshStandardMaterial color="#f6ead2" roughness={0.55} side={THREE.DoubleSide} transparent opacity={0.82} />
        <Edges threshold={50} color={INK} lineWidth={1.2} />
      </mesh>
      <primitive ref={pointsRef} object={points} />
    </group>
  );
}

const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "Through the glass", offset: [0, 0.4, 4.6] },
  { id: "sopra", it: "Dall’alto", en: "From above, as he drew it", offset: [0.01, 4.8, 0.01] },
  { id: "libera", it: "Libera", en: "Free", offset: [3.4, 1.6, 3.4] },
];

function GlassScene({ view }: { view: string }) {
  const subject = useRef<Subject>({ pos: new THREE.Vector3(0, 0, 0), yaw: 0, look: new THREE.Vector3(0, 0, 0) });
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <hemisphereLight args={["#fff4dc", "#d9c398", 1.3]} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#fff1d6" />
      <directionalLight position={[-3, -2, -3]} intensity={0.5} color="#f3e2c0" />
      <GlassValve />
      <FollowCamera subject={subject} view={view} views={VIEWS} minDistance={2} maxDistance={14} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "IV",
  title: "Il cuore",
  ariaLabel: "The heart in three dimensions",
  parts: PARTS,
  whole: "Tutto il cuore",
  overview: { target: [0, 0.2, 0], camera: [2.6, 1.2, 4.6], wide: [4.5, 2, 7.5] },
  Model: HeartModel,
  rest: 0,
  // A beat a little over once a second: a quick squeeze, a slower release.
  animate: (t) => {
    const u = (t % 1.1) / 1.1;
    return u < 0.18 ? Math.sin((u / 0.18) * Math.PI * 0.5) : Math.max(0, 1 - (u - 0.18) / 0.4);
  },
  play: ["fallo battere", "make it beat"],
  lift: 1.9,
  extent: 3.4,
  note: HEART_CREDIT,
  action: {
    label: "Il modello di vetro",
    Scene: GlassScene,
    views: VIEWS,
    start: [3, 2, 6],
    far: 60,
    hint: "a glass root of the aorta: blood rushes up through the open valve, eddies turn in the three pouches, and the cusps swing shut",
  },
};

export default function HeartRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
