"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sound } from "@/lib/sound";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "../ExploreRoom";
import { Figure } from "../figure";
import { Beam, Look, Part, type Drive, type PartDef } from "../kit";
import { Cloud, Coastline, Field, Sky, Smoke, type SmokeHandle } from "../scenery";

/*
 * Folio II in three dimensions: the aerial screw.
 *
 * A helix of starched linen round a mast, turned by four men pushing bars as
 * they walk round the platform. In the action scene the screw spins up, its
 * thrust (∝ ω²) overcomes its weight and it climbs; the crew ease off to hover,
 * then let it settle back. The platform counter-rotates slightly as they push
 * (the torque has to go somewhere), and the downwash raises dust from the field.
 */

const R = 1.9; // radius of the screw
const H0 = 2.1; // bottom of the helix, above the crew's heads
const H1 = 5.1; // top of the helix
const TURNS = 1.1;

function helixPoint(u: number, frac: number) {
  const th = Math.PI * 2 * TURNS * u;
  const r = 0.12 + (R - 0.25 * u - 0.12) * frac;
  return new THREE.Vector3(Math.cos(th) * r, H0 + (H1 - H0) * u, Math.sin(th) * r);
}

function helixGeometry() {
  const NU = 90;
  const NV = 6;
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) pos.push(...helixPoint(i / NU, j / NV).toArray());
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j;
      const b = a + NV + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const RIM_CURVE = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => helixPoint(i / 40, 1)));

const PARTS: PartDef[] = [
  {
    id: "vite",
    italian: "La vite",
    english: "The screw",
    text: "A helix of linen, its pores stopped with starch so air cannot pass. Turned quickly, Leonardo wrote, it would 'make its female in the air' and climb, as a screw climbs into wood.",
    target: [0.6, 3.6, 0.4],
    camera: [4.6, 5.0, 5.2],
    explode: [0, 1.1, 0],
    label: [1.6, 4.2, 0.6],
  },
  {
    id: "cerchio",
    italian: "Il cerchio",
    english: "The rim",
    text: "A rim of cane or iron wire along the outer edge holds the linen taut, so the helix keeps its shape instead of flapping like a loose sail.",
    target: [1.5, 3.3, 0],
    camera: [4.8, 3.9, 2.6],
    explode: [0, 1.7, 0],
    label: [-1.7, 2.6, 0.4],
  },
  {
    id: "albero",
    italian: "L'albero",
    english: "The mast",
    text: "A single upright spine carries the screw and turns with it, resting in an iron bearing at the centre of the platform.",
    target: [0, 2.9, 0],
    camera: [2.8, 3.6, 3.0],
    label: [0, 5.8, 0],
  },
  {
    id: "stanghe",
    italian: "Le stanghe",
    english: "The push bars",
    text: "Four bars fixed to the mast, at chest height for the men who walk round and round pushing them.",
    target: [0.9, 1.15, 0.9],
    camera: [3.0, 2.3, 3.2],
    explode: [0, 0.35, 0],
    label: [1.85, 1.3, 0],
  },
  {
    id: "garzoni",
    italian: "I garzoni",
    english: "The crew",
    text: "Leonardo imagined men turning it by hand. Four people walking in circles could never turn it fast enough to fly, but the idea, a rotor driven by an engine on board, is the helicopter's.",
    target: [-0.9, 1.1, 0.7],
    camera: [-3.4, 2.1, 3.1],
    explode: [0, -0.35, 0],
    label: [0.4, 2.15, -1.3],
  },
  {
    id: "piattaforma",
    italian: "La piattaforma",
    english: "The platform",
    text: "A round deck of planks with an iron bearing in its middle. It is what the crew stand and push against, which is why, in reality, it would spin the other way.",
    target: [0, 0.1, 0],
    camera: [3.4, 1.6, 3.6],
    explode: [0, -0.9, 0],
    label: [0, 0.05, 2.25],
  },
];

const DECK_TOP = 0.17;
const BAR_Y = 1.15; // chest height on the deck
const CREW_R = 1.3; // where the men walk
const BEHIND = 0.62; // radians: how far behind his bar each man walks

/**
 * One of the crew walking behind his bar, leaning into it, both hands on it.
 * The screw turns towards decreasing angle, so he stands at a larger angle
 * than his bar and faces along the direction of travel.
 */
function Pusher({ bar, walked }: { bar: number; walked: Drive }) {
  const b = bar + BEHIND;
  const pos = useMemo(() => new THREE.Vector3(Math.cos(b) * CREW_R, DECK_TOP, Math.sin(b) * CREW_R), [b]);
  const yaw = Math.PI / 2 - b;
  // Grip points on the bar, either side of where his path crosses it, in his own frame.
  const hands = useMemo(() => {
    const inv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
    return [CREW_R - 0.2, CREW_R + 0.2].map((r) =>
      new THREE.Vector3(Math.cos(bar) * r, BAR_Y, Math.sin(bar) * r).sub(pos).applyQuaternion(inv),
    ) as [THREE.Vector3, THREE.Vector3];
  }, [bar, pos, yaw]);
  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      <Figure lean={0.3} hands={hands} walked={walked} />
    </group>
  );
}

function ScrewModel({ drive, deck }: { drive: Drive; deck?: Drive }) {
  const turning = useRef<THREE.Group>(null);
  // How far the crew have walked round the deck, which drives their stride.
  const walked = useRef(0);
  const geo = useMemo(() => ({ helix: helixGeometry(), rim: new THREE.TubeGeometry(RIM_CURVE, 160, 0.035, 6, false) }), []);
  useFrame(() => {
    // The screw turns relative to its deck, which may itself be turning.
    const rel = drive.current - (deck?.current ?? 0);
    if (turning.current) turning.current.rotation.y = rel;
    walked.current = rel * CREW_R;
  });
  const ribs = useMemo(() => Array.from({ length: 12 }, (_, i) => helixPoint(i / 11, 1)), []);
  const bars = [0, 1, 2, 3].map((k) => (k * Math.PI) / 2 + Math.PI / 4);
  return (
    <group>
      <Part id="piattaforma">
        <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[2.2, 2.2, 0.22, 40]} />
          <Look kind="wood" />
        </mesh>
        {/* Deck planks. */}
        {Array.from({ length: 9 }, (_, i) => -1.95 + i * 0.49).map((x) => (
          <mesh key={x} position={[x, 0.18, 0]}>
            <boxGeometry args={[0.02, 0.01, 2 * Math.sqrt(Math.max(0.01, 2.2 * 2.2 - x * x)) - 0.1]} />
            <Look kind="darkwood" edges={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.05, 8, 24]} />
          <Look kind="iron" />
        </mesh>
      </Part>

      <group ref={turning}>
        <Part id="albero">
          <Beam from={[0, 0.12, 0]} to={[0, 5.55, 0]} r={0.075} kind="wood" />
          <mesh position={[0, 5.63, 0]}>
            <coneGeometry args={[0.12, 0.22, 10]} />
            <Look kind="iron" />
          </mesh>
        </Part>
        <Part id="vite">
          <mesh geometry={geo.helix} castShadow>
            <Look kind="cloth" />
          </mesh>
          {ribs.map((p, i) => (
            <Beam key={i} from={[0, p.y, 0]} to={[p.x, p.y, p.z]} r={0.018} kind="cane" sides={5} />
          ))}
        </Part>
        <Part id="cerchio">
          <mesh geometry={geo.rim}>
            <Look kind="iron" />
          </mesh>
        </Part>
        <Part id="stanghe">
          {bars.map((a) => (
            <Beam key={a} from={[0, BAR_Y, 0]} to={[Math.cos(a) * 1.8, BAR_Y, Math.sin(a) * 1.8]} r={0.045} kind="darkwood" />
          ))}
        </Part>
        <Part id="garzoni">
          {bars.map((a) => (
            <Pusher key={a} bar={a} walked={walked} />
          ))}
        </Part>
      </group>
    </group>
  );
}

// ── In alto: lift-off over a field ─────────────────────────────────────────────
const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "Side", offset: [15, 2.5, 3] },
  { id: "lontano", it: "Da lontano", en: "Far", offset: [30, 7, 22] },
  { id: "sopra", it: "Di sopra", en: "Above", offset: [0.01, 16, 2] },
  { id: "sotto", it: "Di sotto", en: "Below", offset: [4, -6, 1] },
  { id: "libera", it: "Libera", en: "Free", offset: [12, 4, 8] },
];

/*
 * Lift-off physics. Thrust T = kT·ω² (plus ground effect near the field)
 * against weight; spin from the crew's torque against air drag ∝ ω². The crew
 * follow a plan: spin up, climb, ease to a hover, then descend and rest.
 */
const MASS = 280; // kg, machine and crew
const G = 9.81;
const KT = 60; // thrust per ω²
const KD = 23; // aerodynamic drag torque per ω²
const INERTIA = 900;

function LiftScene({ view }: { view: string }) {
  const machine = useRef<THREE.Group>(null);
  const deck = useRef<THREE.Group>(null);
  const smoke = useRef<SmokeHandle>(null);
  const drive = useRef(0);
  const deckDrive = useRef(0);
  const sim = useRef({ t: 0, omega: 0, spin: 0, y: 0, vy: 0, deck: 0, lastTurn: 0, puff: 0 });
  const subject = useRef<Subject>({ pos: new THREE.Vector3(), yaw: 0.3, look: new THREE.Vector3() });
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 1 / 30);
    const s = sim.current;
    s.t = (s.t + dt) % 34;
    // The crew's plan over a 34 s cycle.
    const t = s.t;
    const plan = t < 3 ? 0 : t < 8 ? 1 : t < 18 ? 0.86 : t < 26 ? 0.72 : t < 31 ? 0.64 : 0;
    const targetAlt = t < 8 ? 0 : t < 18 ? 9 : t < 26 ? 9 : 0;
    // Torque from the crew, raised or lowered to hold height once airborne.
    const holding = s.y > 0.3 ? (targetAlt - s.y) * 0.5 - s.vy * 0.9 : 0;
    const torque = Math.max(0, 1400 * plan + 220 * holding);
    s.omega += ((torque - KD * s.omega * s.omega) / INERTIA) * dt;
    s.omega = Math.max(0, s.omega);
    s.spin += s.omega * dt;
    // Thrust, boosted near the ground by the cushion of air beneath (ground effect).
    const groundEffect = 1 + 0.35 * Math.exp(-s.y / 1.5);
    const thrust = KT * s.omega * s.omega * groundEffect;
    const onGround = s.y <= 0 && thrust < MASS * G;
    if (onGround) {
      s.y = 0;
      s.vy = 0;
    } else {
      s.vy += ((thrust - MASS * G) / MASS - 0.6 * s.vy) * dt;
      s.y = Math.max(0, s.y + s.vy * dt);
    }
    // The deck is pushed the other way by the crew (reaction torque).
    s.deck -= s.omega * 0.12 * dt;
    drive.current = s.spin;
    if (machine.current) {
      machine.current.position.set(0, s.y + Math.sin(t * 2.1) * 0.03 * Math.min(1, s.y), 0);
      machine.current.rotation.z = Math.sin(t * 0.7) * 0.02 * Math.min(1, s.y);
    }
    if (deck.current) deck.current.rotation.y = s.deck;
    deckDrive.current = s.deck;
    // A whoosh for each half-turn of the screw.
    if (s.spin - s.lastTurn > Math.PI && s.omega > 0.8) {
      s.lastTurn = s.spin;
      sound.flap(Math.min(1, s.omega / 9));
    }
    // Downwash raising dust from the field.
    s.puff += dt * s.omega * Math.exp(-s.y / 3);
    if (s.puff > 1.2) {
      s.puff = 0;
      const a = Math.random() * Math.PI * 2;
      smoke.current?.emit(tmp.current.set(Math.cos(a) * 2.6, 0.3, Math.sin(a) * 2.6), 1.6);
    }
    const sub = subject.current;
    sub.pos.set(0, s.y + 2.7, 0);
    sub.look!.set(0, s.y + 2.7, 0);
  });

  return (
    <>
      <Sky />
      <Coastline />
      <Field />
      {[
        [-40, 28, -70, 34, 3],
        [30, 34, -110, 46, 11],
        [90, 26, -40, 30, 29],
        [-90, 30, 30, 38, 7],
      ].map(([x, y, z, sc, seed], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} seed={seed} />
      ))}
      <group ref={machine}>
        <group ref={deck}>
          <ScrewModel drive={drive} deck={deckDrive} />
        </group>
      </group>
      <Smoke ref={smoke} />
      <FollowCamera subject={subject} view={view} views={VIEWS} minY={0.4} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "II",
  title: "Vite aerea",
  ariaLabel: "The aerial screw in three dimensions",
  parts: PARTS,
  overview: { target: [0, 2.7, 0], camera: [8.4, 6.2, 9.6] },
  Model: ScrewModel,
  rest: 0,
  animate: (t) => t * 1.4,
  play: ["gira la vite", "turn"],
  lift: -0.88,
  extent: 6,
  action: {
    label: "In alto",
    Scene: LiftScene,
    views: VIEWS,
    start: [24, 6, 10],
    hint: "the crew spin it up, it climbs on its own thrust, hovers, then settles",
  },
};

export default function AerialScrewRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
