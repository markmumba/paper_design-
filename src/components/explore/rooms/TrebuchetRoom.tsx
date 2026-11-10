"use client";

import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sound } from "@/lib/sound";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "../ExploreRoom";
import { Beam, INK, Look, Part, SPOT, type Drive, type PartDef } from "../kit";
import { Cloud, Coastline, Field, Sky, Smoke, type SmokeHandle } from "../scenery";

/*
 * Folio V in three dimensions: the trebuchet.
 *
 * The throw is simulated, not animated. A rigid arm on an axle, a hinged
 * counterweight of 1.8 tonnes, a 4 m sling and an 18 kg stone are particles
 * held by distance constraints (verlet integration). Gravity pulls the
 * counterweight down, the arm whips over, the sling swings out behind it and
 * slings the stone faster than the arm alone could; it lets go when the stone
 * is flying about 40° upward, and the stone follows a ballistic arc with air
 * drag. The castle is placed where that very stone comes down.
 */

const P = new THREE.Vector2(0, 4.2); // axle, as (z, y)
const LA = 5.6; // long arm
const LB = 1.5; // short arm
const HC = 1.1; // counterweight hanger
const SL = 4.0; // sling
const COCK = (215 * Math.PI) / 180;
const RELEASE = 40; // degrees: the sling lets go when the stone climbs at this angle
const STONE_Y = 0.3;

type Pt = { z: number; y: number; pz: number; py: number; w: number };
type Sim = { A: Pt; B: Pt; C: Pt; S: Pt; released: boolean };
const pt = (z: number, y: number, m: number): Pt => ({ z, y, pz: z, py: y, w: 1 / m });

/** The cocked pose: arm pulled down at the back, stone in its trough. */
function cocked(): Sim {
  const A = pt(P.x + LA * Math.cos(COCK), P.y + LA * Math.sin(COCK), 25);
  const B = pt(P.x + LB * Math.cos(COCK + Math.PI), P.y + LB * Math.sin(COCK + Math.PI), 25);
  const C = pt(B.z, B.y - HC, 1800);
  const S = pt(A.z + 3.9, STONE_Y, 18);
  return { A, B, C, S, released: false };
}

const SUB = 16;
const DT = 1 / 60 / SUB;

function fixTo(p: Pt, L: number) {
  const dz = p.z - P.x;
  const dy = p.y - P.y;
  const d = Math.hypot(dz, dy);
  p.z = P.x + (dz * L) / d;
  p.y = P.y + (dy * L) / d;
}
function link(a: Pt, b: Pt, L: number, rope = false) {
  const dz = b.z - a.z;
  const dy = b.y - a.y;
  const d = Math.hypot(dz, dy);
  if (rope && d <= L) return;
  const k = (d - L) / d / (a.w + b.w);
  a.z += dz * k * a.w;
  a.y += dy * k * a.w;
  b.z -= dz * k * b.w;
  b.y -= dy * k * b.w;
}

/** Advance one 1/60 s tick. Returns true at the moment of release. */
function tick(s: Sim) {
  let let_go = false;
  const parts = [s.A, s.B, s.C, s.S];
  for (let i = 0; i < SUB; i++) {
    for (const p of parts) {
      // Very light damping: axle friction for the arm, air drag for the stone in flight.
      const k = p === s.S && s.released ? 0.99995 : 0.99999;
      const vz = p.z - p.pz;
      const vy = p.y - p.py;
      p.pz = p.z;
      p.py = p.y;
      p.z += vz * k;
      p.y += vy * k - 9.81 * DT * DT;
    }
    for (let it = 0; it < 10; it++) {
      fixTo(s.A, LA);
      fixTo(s.B, LB);
      link(s.A, s.B, LA + LB);
      link(s.B, s.C, HC);
      if (!s.released) link(s.A, s.S, SL, true);
      if (!s.released && s.S.y < STONE_Y) {
        s.S.y = STONE_Y;
        s.S.py = s.S.y;
      }
    }
    if (!s.released) {
      const vz = (s.S.z - s.S.pz) / DT;
      const vy = (s.S.y - s.S.py) / DT;
      const ang = (Math.atan2(vy, vz) * 180) / Math.PI;
      if (vz > 0 && Math.abs(ang - RELEASE) < 4 && s.S.y > 3) {
        s.released = true;
        let_go = true;
      }
    }
  }
  return let_go;
}

/** Run a whole throw once to learn where the stone flies (to build the castle there). */
function rehearse() {
  const s = cocked();
  const path: [number, number][] = [];
  for (let i = 0; i < 60 * 14; i++) {
    tick(s);
    if (s.released) path.push([s.S.z, s.S.y]);
    if (s.released && s.S.y <= 0) break;
  }
  // The wall stands where the falling stone is still at mid height.
  let wallZ = path.length ? path[path.length - 1][0] : 200;
  for (let i = path.length - 1; i > 0; i--) {
    if (path[i][1] > 4.5) {
      wallZ = path[i][0];
      break;
    }
  }
  return { wallZ };
}

// ── Parts ───────────────────────────────────────────────────────────────────
const PARTS: PartDef[] = [
  {
    id: "braccio",
    italian: "Il braccio",
    english: "The arm",
    text: "A long beam pivoting on the axle, its long side nearly four times its short side, so a slow, heavy fall on one end becomes a fast whip at the other.",
    target: [0, 4.2, -1.5],
    camera: [8.5, 6.0, 2.0],
    explode: [0, 1.0, 0],
    label: [0, 5.4, 1.2],
  },
  {
    id: "contrappeso",
    italian: "Il contrappeso",
    english: "The counterweight",
    text: "A box of stones or lead weighing as much as a hundred stones it throws. Hung on a hinge, it falls more nearly straight down, which gives the arm more energy than a fixed weight.",
    target: [0, 3.2, 1.2],
    camera: [4.4, 4.0, 4.8],
    explode: [0, 0, 1.7],
    label: [0.9, 3.0, 1.3],
  },
  {
    id: "fionda",
    italian: "La fionda",
    english: "The sling",
    text: "A rope and pouch hung from the arm's tip. It swings out behind the arm and adds its own whip, roughly doubling the stone's speed. Its release hook decides the angle of the throw.",
    target: [0, 0.8, -2.4],
    camera: [4.6, 2.6, -4.6],
    explode: [0, 0.6, -1.3],
    label: [0.5, 1.4, -3.2],
  },
  {
    id: "pietra",
    italian: "La pietra",
    english: "The stone",
    text: "The missile rests in a trough under the frame until the sling lifts it. Leonardo studied how such shots fly, drawing their curved paths through the air.",
    target: [0, 0.3, -0.7],
    camera: [2.4, 1.4, 1.4],
    explode: [0, 1.2, -1.6],
    label: [0, 0.85, -0.7],
  },
  {
    id: "perno",
    italian: "Il perno",
    english: "The axle",
    text: "The whole throw turns on this axle, which carries the arm, the counterweight and the jolt of the release.",
    target: [0, 4.2, 0],
    camera: [3.6, 5.2, 2.6],
    explode: [0, 1.6, 0],
    label: [1.5, 4.6, 0],
  },
  {
    id: "telaio",
    italian: "Il telaio",
    english: "The frame",
    text: "Two A-frames on a rectangular base hold the axle high. They must take the full weight of the counterweight and the shock of every throw.",
    target: [0, 2.0, 0],
    camera: [8.0, 4.0, 6.0],
    label: [1.2, 2.0, 2.0],
  },
  {
    id: "argano",
    italian: "L'argano",
    english: "The winch",
    text: "To cock the machine the crew wind the long arm back down with this winch, lifting the counterweight up again, slowly storing the energy the throw releases in an instant.",
    target: [0, 0.7, -3.4],
    camera: [2.8, 2.0, -5.6],
    explode: [0, 0, -1.2],
    label: [1.2, 1.2, -3.4],
  },
];

/** Positions (z, y) of the moving pieces for a given arm angle, sling hanging free. */
function poseFor(theta: number) {
  const A = { z: P.x + LA * Math.cos(theta), y: P.y + LA * Math.sin(theta) };
  const B = { z: P.x + LB * Math.cos(theta + Math.PI), y: P.y + LB * Math.sin(theta + Math.PI) };
  const C = { z: B.z, y: B.y - HC };
  let S = { z: A.z, y: A.y - SL };
  if (S.y < STONE_Y) S = { z: A.z + Math.sqrt(Math.max(0, SL * SL - (A.y - STONE_Y) ** 2)), y: STONE_Y };
  return { A, B, C, S };
}

export type Pose = { A: { z: number; y: number }; B: { z: number; y: number }; C: { z: number; y: number }; S: { z: number; y: number }; stone: boolean };

function TrebuchetModel({ drive, pose }: { drive: Drive; pose?: { current: Pose } }) {
  const arm = useRef<THREE.Group>(null);
  const weight = useRef<THREE.Group>(null);
  const stone = useRef<THREE.Group>(null);
  const hanger = useRef<THREE.Line>(null);
  const sling = useRef<THREE.Line>(null);
  const lines = useMemo(() => {
    const mk = () => {
      const l = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: INK }));
      l.frustumCulled = false;
      return l;
    };
    return { hanger: mk(), sling: mk() };
  }, []);
  useFrame(() => {
    const p = pose?.current ?? { ...poseFor(COCK - drive.current * 2.35), stone: true };
    const theta = Math.atan2(p.A.y - P.y, p.A.z - P.x);
    if (arm.current) arm.current.rotation.x = -theta;
    weight.current?.position.set(0, p.C.y, p.C.z);
    if (stone.current) {
      stone.current.position.set(0, p.S.y, p.S.z);
      stone.current.visible = p.stone;
    }
    const set = (l: THREE.Line | null, a: { z: number; y: number }, b: { z: number; y: number }) => {
      if (!l) return;
      const pos = l.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, 0, a.y, a.z);
      pos.setXYZ(1, 0, b.y, b.z);
      pos.needsUpdate = true;
    };
    set(hanger.current, p.B, p.C);
    // After the release the empty sling trails from the tip.
    set(sling.current, p.A, p.stone ? p.S : { z: p.A.z - Math.cos(theta) * 0.4, y: p.A.y - SL * 0.6 });
  });
  const rails = [1.0, -1.0];
  return (
    <group>
      <Part id="telaio">
        {rails.map((x) => (
          <group key={x}>
            <Beam from={[x, 0.35, -4.2]} to={[x, 0.35, 4.2]} r={0.16} kind="wood" />
            <Beam from={[x, 0.4, -2.5]} to={[x, P.y, 0]} r={0.13} kind="wood" />
            <Beam from={[x, 0.4, 2.5]} to={[x, P.y, 0]} r={0.13} kind="wood" />
            <Beam from={[x, 1.9, -1.5]} to={[x, 1.9, 1.5]} r={0.09} kind="darkwood" />
          </group>
        ))}
        {[-4, -1.5, 1.5, 4].map((z) => (
          <Beam key={z} from={[-1.15, 0.35, z]} to={[1.15, 0.35, z]} r={0.12} kind="darkwood" />
        ))}
        {/* The trough the stone rests in, under the frame. */}
        <mesh position={[0, 0.12, -0.9]} receiveShadow>
          <boxGeometry args={[0.6, 0.08, 4.2]} />
          <Look kind="darkwood" />
        </mesh>
      </Part>
      <Part id="perno">
        <Beam from={[-1.3, P.y, 0]} to={[1.3, P.y, 0]} r={0.11} kind="iron" />
      </Part>
      <Part id="braccio">
        <group ref={arm} position={[0, P.y, 0]}>
          <mesh position={[0, 0, (LA - LB) / 2]} castShadow>
            <boxGeometry args={[0.3, 0.34, LA + LB]} />
            <Look kind="wood" />
          </mesh>
          {[-1.0, 1.2, 3.0, 4.6].map((z) => (
            <mesh key={z} position={[0, 0, z]}>
              <boxGeometry args={[0.34, 0.38, 0.07]} />
              <Look kind="iron" />
            </mesh>
          ))}
          <mesh position={[0, 0, LA + 0.05]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.12, 0.03, 6, 14]} />
            <Look kind="iron" />
          </mesh>
        </group>
      </Part>
      <Part id="contrappeso">
        <group ref={weight}>
          <mesh position={[0, -0.55, 0]} castShadow>
            <boxGeometry args={[1.3, 1.1, 1.3]} />
            <Look kind="darkwood" />
          </mesh>
          {[-0.3, -0.75].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[1.34, 0.06, 1.34]} />
              <Look kind="iron" />
            </mesh>
          ))}
        </group>
        <primitive ref={hanger} object={lines.hanger} />
      </Part>
      <Part id="fionda">
        <primitive ref={sling} object={lines.sling} />
      </Part>
      <Part id="pietra">
        <group ref={stone}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.3, 1]} />
            <Look kind="stone" />
          </mesh>
        </group>
      </Part>
      <Part id="ruote">
        {rails.flatMap((x) =>
          [-3.6, 3.6].map((z) => (
            <mesh key={`${x}${z}`} position={[x * 1.22, 0.35, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.36, 0.36, 0.14, 18]} />
              <Look kind="darkwood" />
            </mesh>
          )),
        )}
      </Part>
      <Part id="argano">
        <mesh position={[0, 0.75, -3.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 1.7, 16]} />
          <Look kind="darkwood" />
        </mesh>
        {[0.95, -0.95].map((x) => (
          <Beam key={x} from={[x, 0.75, -3.4]} to={[x, 1.35, -3.6]} r={0.04} kind="iron" />
        ))}
      </Part>
    </group>
  );
}

// ── Il lancio: the throw ────────────────────────────────────────────────────────
const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "Side", offset: [22, 5, 6] },
  { id: "dietro", it: "Di dietro", en: "Behind", offset: [2, 6, -18] },
  { id: "segui", it: "Segui la pietra", en: "Follow the stone", offset: [6, 2.5, -9] },
  { id: "mura", it: "Alle mura", en: "At the walls", offset: [16, 6, 14] },
  { id: "libera", it: "Libera", en: "Free", offset: [14, 7, -10] },
];

function Castle({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[34, 9, 3]} />
        <meshStandardMaterial color="#d7c39a" roughness={1} />
        <Edges color={INK} lineWidth={1.4} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[-15.5 + i * 2.4, 9.5, -1.2]}>
          <boxGeometry args={[1.2, 1, 0.6]} />
          <meshStandardMaterial color="#d7c39a" roughness={1} />
          <Edges color={INK} lineWidth={1.2} />
        </mesh>
      ))}
      {[-18, 18].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 6.5, 0]} castShadow>
            <cylinderGeometry args={[3, 3.3, 13, 18]} />
            <meshStandardMaterial color="#cdb68b" roughness={1} />
            <Edges color={INK} lineWidth={1.2} threshold={25} />
          </mesh>
          <mesh position={[0, 14.2, 0]}>
            <coneGeometry args={[3.5, 3, 18]} />
            <meshStandardMaterial color="#b68c5a" roughness={1} />
            <Edges color={INK} lineWidth={1.2} threshold={25} />
          </mesh>
          <mesh position={[0.7, 16.4, 0]}>
            <planeGeometry args={[1.4, 0.8]} />
            <meshBasicMaterial color={SPOT} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const DEBRIS = 8;

function ThrowScene({ view }: { view: string }) {
  const { wallZ } = useMemo(() => rehearse(), []);
  const smoke = useRef<SmokeHandle>(null);
  const drive = useRef(0);
  const pose = useRef<Pose>({ ...poseFor(COCK), stone: true });
  const sim = useRef({ s: cocked(), phase: "ready" as "ready" | "throw" | "after" | "cock", t: 0, acc: 0, from: poseFor(COCK) as Pose | ReturnType<typeof poseFor> });
  const chunks = useRef<THREE.Group>(null);
  const debris = useRef(Array.from({ length: DEBRIS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), on: false })));
  const subject = useRef<Subject>({ pos: new THREE.Vector3(), yaw: 0, look: new THREE.Vector3() });

  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 1 / 20);
    const m = sim.current;
    m.t += dt;
    const s = m.s;
    if (m.phase === "ready" && m.t > 2.5) {
      m.phase = "throw";
      m.t = 0;
      sound.clatter();
    }
    if (m.phase === "throw" || m.phase === "after") {
      m.acc += dt;
      while (m.acc >= 1 / 60) {
        m.acc -= 1 / 60;
        if (tick(s)) sound.twang(0.7);
        // The stone strikes the wall, or the ground.
        if (s.released && pose.current.stone && (s.S.y <= 0.2 || (s.S.z >= wallZ - 1.5 && s.S.y < 9.2))) {
          pose.current.stone = false;
          const hit = new THREE.Vector3(0, Math.max(0.5, s.S.y), Math.min(s.S.z, wallZ - 1.5));
          smoke.current?.emit(hit, 6);
          smoke.current?.emit(hit.clone().add(new THREE.Vector3(1, 1, 0)), 5);
          sound.thud(1.4);
          debris.current.forEach((d) => {
            d.on = true;
            d.p.copy(hit);
            d.v.set((Math.random() - 0.5) * 8, 4 + Math.random() * 6, -2 - Math.random() * 5);
          });
          m.phase = "after";
          m.t = 0;
        }
      }
      if (m.phase === "after" && m.t > 4) {
        m.phase = "cock";
        m.t = 0;
        m.from = { A: { z: s.A.z, y: s.A.y }, B: { z: s.B.z, y: s.B.y }, C: { z: s.C.z, y: s.C.y }, S: { z: s.S.z, y: s.S.y }, stone: false };
      }
    }
    if (m.phase === "cock") {
      // The crew wind the arm back down with the winch (eased), and reload.
      const k = Math.min(1, m.t / 4);
      const e = k * k * (3 - 2 * k);
      const from = Math.atan2(m.from.A.y - P.y, m.from.A.z - P.x);
      let to = COCK;
      while (to - from > Math.PI) to -= Math.PI * 2;
      while (from - to > Math.PI) to += Math.PI * 2;
      const pp = poseFor(from + (to - from) * e);
      pose.current = { ...pp, stone: k > 0.85 };
      if (Math.floor(m.t / 0.3) !== Math.floor((m.t - dt) / 0.3)) sound.knock();
      if (k >= 1) {
        m.s = cocked();
        m.phase = "ready";
        m.t = 0;
      }
    } else {
      pose.current = { A: { z: s.A.z, y: s.A.y }, B: { z: s.B.z, y: s.B.y }, C: { z: s.C.z, y: s.C.y }, S: { z: s.S.z, y: s.S.y }, stone: pose.current.stone };
      if (m.phase === "ready") pose.current.stone = true;
    }

    // Debris from the wall.
    const g = chunks.current;
    if (g) {
      debris.current.forEach((d, i) => {
        const c = g.children[i];
        if (!d.on) {
          c.visible = false;
          return;
        }
        d.v.y -= 9.81 * dt;
        d.p.addScaledVector(d.v, dt);
        if (d.p.y < 0.2) {
          d.p.y = 0.2;
          d.v.set(0, 0, 0);
        }
        c.visible = m.phase === "after";
        c.position.copy(d.p);
      });
    }

    const sub = subject.current;
    const flying = view === "segui" && pose.current.stone && m.phase !== "ready" && m.phase !== "cock";
    if (flying) {
      sub.pos.set(0, Math.max(1, s.S.y), s.S.z);
      sub.look!.copy(sub.pos);
    } else if (view === "mura") {
      sub.pos.set(0, 5, wallZ);
      sub.look!.set(0, 4, wallZ - 10);
    } else {
      sub.pos.set(0, 3.5, 0);
      sub.look!.set(0, 3.5, 2);
    }
    sub.yaw = 0;
  });

  return (
    <>
      <Sky fogFar={420} />
      <Coastline />
      <Field size={900} />
      {[
        [-40, 30, -70, 34, 3],
        [40, 36, 120, 46, 11],
        [-70, 30, 200, 38, 7],
      ].map(([x, y, z, sc, seed], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} seed={seed} />
      ))}
      <TrebuchetModel drive={drive} pose={pose} />
      <Castle z={wallZ} />
      <group ref={chunks}>
        {Array.from({ length: DEBRIS }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.5, 0.4, 0.45]} />
            <meshStandardMaterial color="#cdb68b" />
            <Edges color={INK} />
          </mesh>
        ))}
      </group>
      <Smoke ref={smoke} />
      <FollowCamera subject={subject} view={view} views={VIEWS} minY={0.5} maxDistance={90} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "V",
  title: "Trabocco",
  ariaLabel: "The trebuchet in three dimensions",
  parts: PARTS,
  overview: { target: [0, 3.0, 0], camera: [12, 7, 10] },
  Model: TrebuchetModel,
  rest: 0,
  animate: (t) => 0.5 - 0.5 * Math.cos(t * 0.9),
  play: ["muovi il braccio", "swing"],
  lift: -0.88,
  extent: 8,
  action: {
    label: "Il lancio",
    Scene: ThrowScene,
    views: VIEWS,
    start: [26, 8, -4],
    far: 900,
    hint: "simulated, not animated: the counterweight falls, the sling whips, the stone lets go at 40°",
  },
};

export default function TrebuchetRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
