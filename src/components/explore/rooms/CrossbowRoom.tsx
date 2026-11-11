"use client";

import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { stepped } from "@/components/cues";
import { sound } from "@/lib/sound";

/** The winch drum turns 9 rad over a full draw and its ratchet wheel has 18 teeth: one click a tooth, winding only. */
const ratchet = (draw: number, was: number) => {
  if (draw > was && stepped(was * 9, draw * 9, (Math.PI * 2) / 18)) sound.tick();
};
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "../ExploreRoom";
import { Beam, INK, Look, Part, SPOT, Wheel, gearGeometry, type Drive, type PartDef } from "../kit";
import { Cloud, Coastline, Field, Sky, Smoke, type SmokeHandle } from "../scenery";

/*
 * Folio IV in three dimensions: the giant crossbow.
 *
 * Six splayed wheels under a long bed, a laminated bow, a winch that draws the
 * string back to a trigger nut. In the action scene the winch draws it (the bow
 * arms flex as they store energy), the nut is struck, and the string snaps
 * forward as a damped spring, handing its speed to the bolt, which flies a
 * real ballistic arc with drag into a target down the range.
 */

const BED_Y = 1.0;
const BOW_C = new THREE.Vector3(0, 1.25, 4.3);
const TIP = new THREE.Vector3(4.6, 0, -1.1); // right tip relative to the bow centre
const NUT_REST = 3.2;
const NUT_DRAWN = -1.8;
const ARM_FLEX = 0.24;
const WHEEL_SPLAY = 0.2; // radians each wheel leans in at the top

const ARM_CURVE = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.6, 0, 0.45), TIP);

/** Where the right bow tip is (world, in model frame) for a given draw. */
function tipAt(draw: number, side: 1 | -1, out: THREE.Vector3) {
  const phi = ARM_FLEX * draw * side;
  out.set(TIP.x * side, 0, TIP.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), phi);
  return out.add(BOW_C);
}
const nutZ = (draw: number) => NUT_REST + (NUT_DRAWN - NUT_REST) * draw;

const PARTS: PartDef[] = [
  {
    id: "arco",
    italian: "L'arco",
    english: "The bow",
    text: "Leonardo specified a span of some 42 braccia, about 24 metres. He drew the arms thin and laminated, in layers, so they could flex deeply without breaking.",
    target: [0, 1.25, 3.8],
    camera: [7.4, 5.0, 9.4],
    explode: [0, 0.9, 0.8],
    label: [3.9, 1.45, 3.3],
  },
  {
    id: "corda",
    italian: "La corda",
    english: "The string",
    text: "A heavy cord running from tip to tip, drawn back by the winch until it catches in the trigger nut.",
    target: [0, 1.3, 2.4],
    camera: [3.0, 3.2, 5.4],
    explode: [0, 1.5, 0.4],
    label: [-2.4, 1.5, 2.5],
  },
  {
    id: "noce",
    italian: "La noce",
    english: "The trigger nut",
    text: "The catch that holds the drawn string. Leonardo drew two releases: one sprung, one struck free with a mallet, so the crew could stand well clear.",
    target: [0, 1.3, 0.5],
    camera: [1.6, 2.0, 2.2],
    explode: [0, 0.9, 0],
    label: [0.3, 1.75, 0.5],
  },
  {
    id: "dardo",
    italian: "Il dardo",
    english: "The bolt",
    text: "The missile: a heavy bolt here, though Leonardo's notes suggest it might throw stones, or even incendiary bombs. It may have been meant to terrify more than to kill.",
    target: [0, 1.35, 2.4],
    camera: [2.4, 2.6, 4.6],
    explode: [0, 1.3, 0],
    label: [0.4, 1.7, 3.4],
  },
  {
    id: "argano",
    italian: "L'argano",
    english: "The winch",
    text: "A geared winch at the back, turned by crank, hauls the string and nut back along the bed. Gearing let a few men store a great deal of energy in the bow.",
    target: [0, 1.4, -3.7],
    camera: [2.6, 2.6, -6.2],
    explode: [0, 0.6, -1.0],
    label: [1.0, 2.0, -3.7],
  },
  {
    id: "letto",
    italian: "Il letto",
    english: "The bed",
    text: "The long carriage the bow is mounted on, with a groove along its top for the bolt. On the sheet it is about as long as the bow is wide.",
    target: [0, 1.0, 0],
    camera: [5.0, 3.2, 3.6],
    label: [0.6, 1.25, -2.0],
  },
  {
    id: "ruote",
    italian: "Le ruote",
    english: "The wheels",
    text: "Six wheels, splayed outwards. Leaning them gives a wider, steadier stance against the bow's recoil and lets the machine be wheeled into aim.",
    target: [1.0, 0.6, 0],
    camera: [4.4, 1.4, 2.0],
    explode: [0, -0.7, 0],
    label: [1.6, 0.05, 3.0],
  },
];

function Arm({ side, drive }: { side: 1 | -1; drive: Drive }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(
    () => ({
      main: new THREE.TubeGeometry(ARM_CURVE, 30, 0.1, 8, false),
      lam: new THREE.TubeGeometry(ARM_CURVE, 30, 0.055, 6, false),
    }),
    [],
  );
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = ARM_FLEX * drive.current;
  });
  return (
    <group position={BOW_C.toArray()} scale={[side, 1, 1]}>
      <group ref={ref}>
        <mesh geometry={geo.main} castShadow>
          <Look kind="darkwood" />
        </mesh>
        {/* Laminations above and below the core. */}
        <mesh geometry={geo.lam} position={[0, 0.13, 0]}>
          <Look kind="wood" />
        </mesh>
        <mesh geometry={geo.lam} position={[0, -0.13, 0]}>
          <Look kind="wood" />
        </mesh>
        <mesh position={TIP.toArray()}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <Look kind="iron" />
        </mesh>
      </group>
    </group>
  );
}

/** The string: tip → nut → tip, following the draw. */
function StringLine({ drive }: { drive: Drive }) {
  const ref = useRef<THREE.Line>(null);
  const line0 = useMemo(() => new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3)), new THREE.LineBasicMaterial({ color: INK })), []);
  const tmp = useRef(new THREE.Vector3());
  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    const d = drive.current;
    tipAt(d, -1, tmp.current);
    pos.setXYZ(0, tmp.current.x, tmp.current.y, tmp.current.z);
    pos.setXYZ(1, 0, 1.3, nutZ(d));
    tipAt(d, 1, tmp.current);
    pos.setXYZ(2, tmp.current.x, tmp.current.y, tmp.current.z);
    pos.needsUpdate = true;
  });
  return <primitive object={line0} ref={ref} frustumCulled={false} />;
}

function BoltMesh() {
  return (
    <group>
      <mesh position={[0, 0, 1.6]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3.2, 8]} />
        <Look kind="wood" />
      </mesh>
      <mesh position={[0, 0, 3.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.32, 8]} />
        <Look kind="iron" />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[0, 0, 0.25]} rotation={[0, 0, r]}>
          <boxGeometry args={[0.34, 0.01, 0.5]} />
          <Look kind="spot" />
        </mesh>
      ))}
    </group>
  );
}

function CrossbowModel({ drive, boltOut }: { drive: Drive; boltOut?: Drive }) {
  const nut = useRef<THREE.Group>(null);
  const bolt = useRef<THREE.Group>(null);
  const drum = useRef<THREE.Mesh>(null);
  const rope = useRef<THREE.Line>(null);
  const ropeLine = useMemo(() => new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: INK })), []);
  const geo = useMemo(() => ({ gear: gearGeometry(0.42, 18, 0.07, 0.1) }), []);
  useFrame(() => {
    const d = drive.current;
    const z = nutZ(d);
    nut.current?.position.set(0, 1.3, z);
    if (bolt.current) {
      bolt.current.position.set(0, 1.33, z + 0.05);
      // Hidden here while the scene flies its own bolt.
      bolt.current.visible = !(boltOut && boltOut.current > 0);
    }
    if (drum.current) drum.current.rotation.x = d * 9;
    const line = rope.current;
    if (line) {
      const pos = line.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, 0, 1.45, -3.7);
      pos.setXYZ(1, 0, 1.32, z - 0.1);
      pos.needsUpdate = true;
    }
  });
  const wheels: [number, number][] = [-3, 0, 3].flatMap((z) => [
    [0.95, z],
    [-0.95, z],
  ]) as [number, number][];
  return (
    <group>
      <Part id="letto">
        <mesh position={[0, BED_Y, 0.2]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.35, 8.4]} />
          <Look kind="wood" />
        </mesh>
        <mesh position={[0, BED_Y + 0.18, 0.2]}>
          <boxGeometry args={[0.16, 0.02, 8.4]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        {[-2.8, -0.4, 2.0, 3.9].map((z) => (
          <mesh key={z} position={[0, BED_Y, z]}>
            <boxGeometry args={[0.86, 0.38, 0.08]} />
            <Look kind="iron" />
          </mesh>
        ))}
      </Part>
      <Part id="ruote">
        {wheels.map(([x, z], i) => (
          // Splayed as on the sheet: the feet stand wide and the tops lean in
          // towards the bed, so the stance is broader than the carriage.
          <group key={i} position={[x, 0.63, z]} rotation={[0, 0, Math.sign(x) * WHEEL_SPLAY]}>
            <Wheel r={0.6} width={0.16} spokes={8} />
          </group>
        ))}
        {[-3, 0, 3].map((z) => (
          <Beam key={z} from={[-0.98, 0.63, z]} to={[0.98, 0.63, z]} r={0.06} kind="iron" />
        ))}
      </Part>
      <Part id="arco">
        <Arm side={1} drive={drive} />
        <Arm side={-1} drive={drive} />
        <mesh position={BOW_C.toArray()}>
          <boxGeometry args={[0.6, 0.5, 0.5]} />
          <Look kind="iron" />
        </mesh>
      </Part>
      <Part id="corda">
        <StringLine drive={drive} />
      </Part>
      <Part id="noce">
        <group ref={nut}>
          <mesh castShadow>
            <boxGeometry args={[0.36, 0.22, 0.3]} />
            <Look kind="iron" />
          </mesh>
          <Beam from={[0, -0.1, -0.1]} to={[0, -0.55, -0.4]} r={0.03} kind="iron" />
        </group>
      </Part>
      <Part id="dardo">
        <group ref={bolt}>
          <BoltMesh />
        </group>
      </Part>
      <Part id="argano">
        <mesh ref={drum} position={[0, 1.45, -3.7]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.75, 16]} />
          <Look kind="darkwood" />
        </mesh>
        {[0.5, -0.5].map((x) => (
          <group key={x}>
            <mesh geometry={geo.gear} position={[x, 1.45, -3.7]} rotation={[0, Math.PI / 2, 0]}>
              <Look kind="wood" />
            </mesh>
            <Beam from={[x * 1.2, 1.45, -3.7]} to={[x * 1.2, 1.95, -3.95]} r={0.035} kind="iron" />
          </group>
        ))}
        <primitive ref={rope} object={ropeLine} frustumCulled={false} />
      </Part>
    </group>
  );
}

// ── Al tiro: down the range ─────────────────────────────────────────────────────
const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "Side", offset: [14, 4, 2] },
  { id: "dietro", it: "Di dietro", en: "Behind", offset: [1.5, 3.2, -11] },
  { id: "segui", it: "Segui il dardo", en: "Follow the bolt", offset: [2.2, 1.0, -5] },
  { id: "bersaglio", it: "Al bersaglio", en: "At the target", offset: [5, 2, 8] },
  { id: "libera", it: "Libera", en: "Free", offset: [9, 5, -8] },
];

const TARGET_Z = 46;
const TARGET_Y = 1.7;
const LAUNCH_Y = 1.33;
const G = 9.81;
const DRAG = 0.0012; // per metre, for a heavy bolt
const K = 110; // string stiffness (per unit draw)
const C = 7; // string damping
const STROKE = NUT_REST - NUT_DRAWN; // metres of string travel at full draw

/** Simulate one shot to find the elevation that lands on the target. */
function aimElevation(speed: number) {
  const fly = (el: number) => {
    let z = NUT_REST + 3.2, y = LAUNCH_Y, vz = speed * Math.cos(el), vy = speed * Math.sin(el);
    const dt = 1 / 240;
    for (let i = 0; i < 4000 && z < TARGET_Z; i++) {
      const v = Math.hypot(vz, vy);
      vz -= DRAG * v * vz * dt;
      vy -= (G + DRAG * v * vy) * dt;
      z += vz * dt;
      y += vy * dt;
    }
    return y;
  };
  let lo = -0.05, hi = 0.4;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fly(mid) < TARGET_Y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function RangeScene({ view }: { view: string }) {
  const machine = useRef<THREE.Group>(null);
  const bolt = useRef<THREE.Group>(null);
  const smoke = useRef<SmokeHandle>(null);
  const drive = useRef(0);
  const boltOut = useRef(0);
  // The bolt leaves at the string's top speed: stroke × natural frequency.
  const speed = STROKE * Math.sqrt(K);
  const elevation = useMemo(() => aimElevation(speed), [speed]);
  const sim = useRef({ t: 0, phase: "wind" as "wind" | "hold" | "loose" | "rest", x: 0, xv: 0, bz: 0, by: 0, bvz: 0, bvy: 0, flying: false, stuck: false, restT: 0 });
  const subject = useRef<Subject>({ pos: new THREE.Vector3(), yaw: 0, look: new THREE.Vector3() });
  const tmp = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 1 / 30);
    const s = sim.current;
    s.t += dt;
    if (s.phase === "wind") {
      // The winch draws steadily; the ratchet clicks as it goes.
      const was = s.x;
      s.x = Math.min(1, s.x + dt / 3);
      ratchet(s.x, was);
      if (s.x >= 1) {
        s.phase = "hold";
        s.t = 0;
      }
    } else if (s.phase === "hold") {
      if (s.t > 1.2) {
        s.phase = "loose";
        s.xv = 0;
        sound.twang();
      }
    } else if (s.phase === "loose") {
      // The string is a damped spring released from full draw.
      const prev = s.x;
      s.xv += (-K * s.x - C * s.xv) * dt;
      s.x += s.xv * dt;
      // The bolt rides the string until the string passes its rest line.
      if (!s.flying && prev > 0 && s.x <= 0) {
        s.flying = true;
        boltOut.current = 1;
        s.bz = NUT_REST + 0.05;
        s.by = LAUNCH_Y;
        s.bvz = speed * Math.cos(elevation);
        s.bvy = speed * Math.sin(elevation);
        // The arms stop dead as the bolt leaves: heard on that frame, under the string's hum.
        sound.thud(0.45);
        // The arms slam forward and the carriage jolts: dust is thrown ahead
        // from under each arm and out sideways from under the wheels.
        const puffs = smoke.current;
        if (puffs) {
          const at = tmp.current;
          for (const side of [1, -1]) {
            puffs.burst(at.set(side * 2.6, 0.2, 4.4), { kind: "dust", size: 0.6, dir: dir.current.set(side * 0.5, 0.3, 1), speed: 6, spread: 0.5, count: 5 });
            puffs.burst(at.set(side * 1.2, 0.15, 0), { kind: "dust", size: 0.4, dir: dir.current.set(side, 0.25, -0.2), speed: 3.5, spread: 0.5, count: 3 });
          }
        }
      }
      if (Math.abs(s.x) < 0.002 && Math.abs(s.xv) < 0.02) {
        s.x = 0;
        s.phase = "rest";
        s.restT = 0;
      }
    } else {
      s.restT += dt;
      if (s.restT > 3.5 && (s.stuck || !s.flying)) {
        // Reload and draw again.
        s.phase = "wind";
        s.flying = false;
        s.stuck = false;
        boltOut.current = 0;
      }
    }
    drive.current = s.x;

    // The bolt's flight: gravity and quadratic drag, pointing along its velocity.
    const b = bolt.current;
    if (b) {
      b.visible = s.flying;
      if (s.flying && !s.stuck) {
        const v = Math.hypot(s.bvz, s.bvy);
        s.bvz -= DRAG * v * s.bvz * dt;
        s.bvy -= (G + DRAG * v * s.bvy) * dt;
        s.bz += s.bvz * dt;
        s.by += s.bvy * dt;
        // The head is 3.35 m ahead of the nock; it buries itself in the straw.
        const head = s.bz + 3.35;
        const hitTarget = head >= TARGET_Z - 0.3 && Math.abs(s.by - TARGET_Y) < 1.4;
        if (hitTarget || s.by <= 0.05) {
          s.stuck = true;
          if (hitTarget) s.bz = TARGET_Z - 0.3 - 3.35 + 0.9;
          sound.thud(hitTarget ? 1 : 0.6);
          // Straw and dust are knocked back out of the butt, the way the bolt
          // came; a miss ploughs the field and throws earth on ahead.
          smoke.current?.burst(tmp.current.set(0, Math.max(0.3, s.by), s.bz + 3.2), {
            kind: "dust",
            size: 0.8,
            dir: dir.current.set(0, hitTarget ? 0.5 : 0.8, hitTarget ? -1 : 0.6),
            speed: hitTarget ? 5 : 4,
            spread: 0.6,
            count: 7,
          });
        }
        b.position.set(0, s.by, s.bz);
        b.rotation.x = -Math.atan2(s.bvy, s.bvz);
      }
    }
    const sub = subject.current;
    if ((view === "segui" && s.flying) || view === "bersaglio") {
      sub.pos.set(0, view === "bersaglio" ? 1.8 : s.by, view === "bersaglio" ? TARGET_Z : s.bz + 1.5);
      sub.look!.copy(sub.pos);
    } else {
      sub.pos.set(0, 1.4, 1);
      sub.look!.set(0, 1.3, 2);
    }
    sub.yaw = view === "bersaglio" ? Math.PI : 0;
  });

  return (
    <>
      <Sky />
      <Coastline />
      <Field />
      {[
        [-40, 28, -70, 34, 3],
        [30, 34, 80, 46, 11],
        [90, 26, 40, 30, 29],
      ].map(([x, y, z, sc, seed], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} seed={seed} />
      ))}
      <group ref={machine}>
        <CrossbowModel drive={drive} boltOut={boltOut} />
      </group>
      <group ref={bolt} visible={false}>
        <BoltMesh />
      </group>
      {/* The target: a straw butt on a wooden stand, its eye in the spot colour. */}
      <group position={[0, 0, TARGET_Z]}>
        <mesh position={[0, TARGET_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[1.5, 1.5, 0.6, 28]} />
          <meshStandardMaterial color="#d9c08a" roughness={1} />
          <Edges color={INK} lineWidth={1.4} />
        </mesh>
        {[1.0, 0.55].map((r, i) => (
          <mesh key={r} position={[0, TARGET_Y, -0.31 - i * 0.002]} rotation={[0, Math.PI, 0]}>
            <ringGeometry args={[r - 0.18, r, 32]} />
            <meshBasicMaterial color={i ? SPOT : INK} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0, TARGET_Y, -0.32]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.22, 24]} />
          <meshBasicMaterial color={SPOT} side={THREE.DoubleSide} />
        </mesh>
        {[-1.2, 1.2].map((x) => (
          <Beam key={x} from={[x, 0, 0.2]} to={[x * 0.7, TARGET_Y + 0.6, 0.1]} r={0.08} kind="darkwood" />
        ))}
      </group>
      <Smoke ref={smoke} />
      <FollowCamera subject={subject} view={view} views={VIEWS} minY={0.3} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "IV",
  title: "Balestra gigante",
  ariaLabel: "The giant crossbow in three dimensions",
  parts: PARTS,
  overview: { target: [0, 1.2, 0.6], camera: [9.5, 6.5, 9.5] },
  Model: CrossbowModel,
  rest: 0,
  animate: (t) => 0.5 - 0.5 * Math.cos(t * 1.2),
  voice: ratchet,
  play: ["tendi l'arco", "draw"],
  lift: -0.88,
  extent: 7,
  action: {
    label: "Al tiro",
    Scene: RangeScene,
    views: VIEWS,
    start: [18, 7, -6],
    hint: "the winch draws the bow, the nut is struck, and the bolt flies a real arc to the target",
  },
};

export default function CrossbowRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
