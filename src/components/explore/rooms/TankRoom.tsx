"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { stepped } from "@/components/cues";
import { sound } from "@/lib/sound";

/** The wheels and gears are heard as they turn: a low wooden knock every eighth of a wheel's turn. */
const rumble = (angle: number, was: number, k = 0.8) => {
  if (stepped(was, angle, Math.PI / 4)) sound.tick(k, 0.45);
};
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "../ExploreRoom";
import { Beam, INK, Look, PAPER, Part, Wheel, gearGeometry, type Drive, type PartDef } from "../kit";
import { Cloud, Coastline, Field, Sky, Smoke, type SmokeHandle } from "../scenery";

/*
 * Folio III in three dimensions: the armoured car.
 *
 * A sloped wooden shell over a ring of light cannons, rolled along by crew
 * turning cranks that drive the wheels through gears. In the action scene it
 * crosses a plain: crank torque against rolling resistance sets its speed, the
 * wheels turn at exactly v / r, the gears at their ratio, and it fires its
 * cannons in turn, each shot rocking it on its wheels and leaving smoke.
 */

const WHEEL_R = 0.42;
const CONE_BASE = 1.1;
const CONE_H = 2.0;
const CONE_R = 2.6;
const CANNONS = 8;
const GEAR_RATIO = 2.2; // pinion turns per wheel turn

const coneR = (y: number) => CONE_R * (1 - (y - CONE_BASE) / CONE_H);

const PARTS: PartDef[] = [
  {
    id: "guscio",
    italian: "Il guscio",
    english: "The shell",
    text: "A cone of planks clad in metal plates, sloped so that stones and shot glance off rather than strike square. Its shape is the oldest trick in armour.",
    target: [0, 2.0, 0],
    camera: [5.6, 4.4, 6.2],
    explode: [0, 2.3, 0],
    label: [1.3, 2.4, 0.9],
  },
  {
    id: "torretta",
    italian: "La torretta",
    english: "The lookout",
    text: "A small turret at the apex where one of the crew could look out through slits and direct the drivers and gunners below.",
    target: [0, 3.2, 0],
    camera: [1.8, 3.9, 2.2],
    explode: [0, 3.5, 0],
    label: [0, 3.95, 0],
  },
  {
    id: "bombarde",
    italian: "Le bombarde",
    english: "The cannons",
    text: "Light guns all round the rim, so the car could fire in any direction without turning. In the letter to his patron Leonardo promised these covered cars would break any line of men.",
    target: [2.0, 0.8, 1.2],
    camera: [4.6, 1.7, 3.6],
    explode: [0, 1.5, 0],
    label: [2.9, 0.85, -1.2],
  },
  {
    id: "gonna",
    italian: "La gonna",
    english: "The skirt",
    text: "An upright band of planks round the base, pierced for the cannons, keeping the crew and wheels inside the protection of the shell.",
    target: [0, 0.8, 2.4],
    camera: [2.4, 1.3, 5.6],
    explode: [0, 1.0, 0],
    label: [-1.9, 0.6, 1.9],
  },
  {
    id: "manovelle",
    italian: "Le manovelle",
    english: "The cranks",
    text: "Eight men inside turned these cranks. Each crank's small gear drives a large one on the axle, trading speed for force so they could move the heavy car.",
    target: [0, 1.35, 0.9],
    camera: [1.6, 2.2, 3.2],
    explode: [0, 1.2, 0],
    label: [0.7, 1.75, 0.9],
  },
  {
    id: "ingranaggi",
    italian: "Gli ingranaggi",
    english: "The gears",
    text: "Pinion and crown wheel. Look closely at Leonardo's sheet and the gearing on one axle is drawn turning the wrong way, which some think was deliberate, to stop a copied car from working.",
    target: [0, 0.65, 0.9],
    camera: [1.4, 1.0, 2.6],
    explode: [0, 0.45, 0],
    label: [-0.7, 0.95, 0.95],
  },
  {
    id: "ruote",
    italian: "Le ruote",
    english: "The wheels",
    text: "Four wheels hidden under the skirt, safe from attack. The car could only roll on firm, open ground, one reason it was never built.",
    target: [0.95, 0.42, 0.9],
    camera: [3.2, 0.9, 3.0],
    explode: [0, -0.65, 0],
    label: [1.5, 0.1, -0.9],
  },
];

const WHEELS: [number, number][] = [
  [0.95, 0.9],
  [-0.95, 0.9],
  [0.95, -0.9],
  [-0.95, -0.9],
];

function TankModel({ drive }: { drive: Drive }) {
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const crowns = useRef<(THREE.Mesh | null)[]>([]);
  const pinions = useRef<(THREE.Group | null)[]>([]);
  const geo = useMemo(() => {
    const cone = new THREE.ConeGeometry(CONE_R, CONE_H, 28, 1, true);
    return {
      cone,
      crown: gearGeometry(0.42, 22, 0.06, 0.07),
      pinion: gearGeometry(0.19, 10, 0.05, 0.08),
    };
  }, []);
  useFrame(() => {
    const a = drive.current;
    wheels.current.forEach((w) => w && (w.rotation.x = a));
    crowns.current.forEach((c) => c && (c.rotation.z = a));
    pinions.current.forEach((p, i) => p && (p.rotation.y = (i % 2 ? -1 : 1) * a * GEAR_RATIO));
  });
  const hoops = [1.55, 2.05, 2.55];
  return (
    <group>
      {/* The deck the crew stand on. */}
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.45, 2.45, 0.1, 36]} />
        <Look kind="darkwood" />
      </mesh>
      <Part id="guscio">
        <mesh geometry={geo.cone} position={[0, CONE_BASE + CONE_H / 2, 0]} castShadow>
          <Look kind="wood" />
        </mesh>
        {hoops.map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[coneR(y) + 0.02, 0.03, 6, 48]} />
            <Look kind="iron" />
          </mesh>
        ))}
        {/* Sight slits. */}
        {[0.4, 2.1, 3.8, 5.5].map((a) => (
          <mesh key={a} position={[Math.cos(a) * coneR(2.2), 2.2, Math.sin(a) * coneR(2.2)]} rotation={[0, -a + Math.PI / 2, 0.47]}>
            <boxGeometry args={[0.36, 0.06, 0.04]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
      </Part>
      <Part id="torretta">
        <mesh position={[0, 3.22, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.5, 16]} />
          <Look kind="wood" />
        </mesh>
        <mesh position={[0, 3.6, 0]} castShadow>
          <coneGeometry args={[0.38, 0.32, 16]} />
          <Look kind="darkwood" />
        </mesh>
        <Beam from={[0, 3.7, 0]} to={[0, 4.4, 0]} r={0.018} kind="iron" />
        <mesh position={[0.22, 4.25, 0]}>
          <planeGeometry args={[0.44, 0.24]} />
          <Look kind="spot" />
        </mesh>
      </Part>
      <Part id="gonna">
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[CONE_R, CONE_R, 0.6, 40, 1, true]} />
          <Look kind="wood" />
        </mesh>
      </Part>
      <Part id="bombarde">
        {Array.from({ length: CANNONS }, (_, i) => {
          const a = (i / CANNONS) * Math.PI * 2 + Math.PI / CANNONS;
          return (
            <group key={i} position={[Math.cos(a) * CONE_R, 0.82, Math.sin(a) * CONE_R]} rotation={[0, -a, 0]}>
              <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.07, 0.085, 0.75, 12]} />
                <Look kind="metal" />
              </mesh>
              <mesh position={[0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.075, 0.018, 6, 14]} />
                <Look kind="iron" />
              </mesh>
            </group>
          );
        })}
      </Part>
      <Part id="ruote">
        {WHEELS.map(([x, z], i) => (
          <group key={i} position={[x, WHEEL_R, z]} ref={(g) => void (wheels.current[i] = g)}>
            <Wheel r={WHEEL_R} width={0.14} spokes={8} />
          </group>
        ))}
        {[0.9, -0.9].map((z) => (
          <Beam key={z} from={[-1.05, WHEEL_R, z]} to={[1.05, WHEEL_R, z]} r={0.05} kind="iron" />
        ))}
      </Part>
      <Part id="ingranaggi">
        {[0.9, -0.9].map((z, i) => (
          <group key={z}>
            <mesh geometry={geo.crown} position={[0.35, WHEEL_R, z]} rotation={[0, Math.PI / 2, 0]} ref={(m) => void (crowns.current[i] = m)}>
              <Look kind="darkwood" />
            </mesh>
            <group position={[0.12, WHEEL_R + 0.44, z]} ref={(g) => void (pinions.current[i] = g)}>
              <mesh geometry={geo.pinion} rotation={[Math.PI / 2, 0, 0]}>
                <Look kind="wood" />
              </mesh>
            </group>
          </group>
        ))}
      </Part>
      <Part id="manovelle">
        {[0.9, -0.9].map((z) => (
          <group key={z}>
            <Beam from={[0.12, WHEEL_R + 0.44, z]} to={[0.12, 1.45, z]} r={0.035} kind="iron" />
            <Beam from={[0.12, 1.45, z]} to={[0.42, 1.45, z]} r={0.03} kind="iron" />
            <Beam from={[0.42, 1.45, z]} to={[0.42, 1.25, z]} r={0.04} kind="wood" />
          </group>
        ))}
      </Part>
    </group>
  );
}

// ── In marcia: across the plain, firing ─────────────────────────────────────────
const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "Side", offset: [10, 3, 1] },
  { id: "dietro", it: "Di dietro", en: "Behind", offset: [0, 4.5, -12] },
  { id: "basso", it: "Rasoterra", en: "Ground level", offset: [3, 0.7, 8] },
  { id: "sopra", it: "Di sopra", en: "Above", offset: [0.01, 20, -3] },
  { id: "libera", it: "Libera", en: "Free", offset: [9, 5, -7] },
];

const MASS = 3200;
const CRANK_FORCE = 2400; // total tractive force from eight cranking men (N)
const ROLLING = 0.06; // rolling resistance coefficient on grass

/** Ink tracks pressed into the field behind the wheels, fading into the paper. */
const TRACK = 240;
function makeTrack() {
  const geo = new THREE.BufferGeometry();
  const colors = new Float32Array(TRACK * 3);
  const ink = new THREE.Color(INK);
  const paper = new THREE.Color(PAPER);
  for (let i = 0; i < TRACK; i++) {
    const c = ink.clone().lerp(paper, Math.pow(i / (TRACK - 1), 0.8));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRACK * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true }));
  line.frustumCulled = false;
  return line;
}

function MarchScene({ view }: { view: string }) {
  const tank = useRef<THREE.Group>(null);
  const smoke = useRef<SmokeHandle>(null);
  const drive = useRef(0);
  const sim = useRef({ t: 0, v: 0, yaw: 0, x: -10, z: -6, rockX: 0, rockXV: 0, rockZ: 0, rockZV: 0, nextVolley: 5, shot: -1, shotAt: 0, trackDist: 0, dust: 0, filled: false });
  const subject = useRef<Subject>({ pos: new THREE.Vector3(), yaw: 0, look: new THREE.Vector3() });
  const lines = useMemo(() => [makeTrack(), makeTrack()], []);
  const left = useRef<THREE.Line>(null);
  const right = useRef<THREE.Line>(null);
  const tmp = useRef({ v: new THREE.Vector3(), d: new THREE.Vector3() });

  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 1 / 30);
    const s = sim.current;
    s.t += dt;
    // Crank force against rolling resistance: it creeps up to walking pace.
    const resist = ROLLING * MASS * 9.81 + 120 * s.v * s.v;
    s.v += ((CRANK_FORCE - resist) / MASS) * dt;
    s.v = Math.max(0, s.v);
    s.yaw += 0.035 * dt; // a long, gentle curve across the plain
    s.x += Math.sin(s.yaw) * s.v * dt;
    s.z += Math.cos(s.yaw) * s.v * dt;
    // Wheels roll without slipping: ω = v / r.
    const rolled = drive.current;
    drive.current += (s.v / WHEEL_R) * dt;
    rumble(drive.current, rolled, 0.6);

    // Volleys: the cannons fire in turn round the ring.
    if (s.t > s.nextVolley && s.shot < 0) {
      s.shot = 0;
      s.shotAt = s.t;
    }
    const g = tank.current;
    if (s.shot >= 0 && g && s.t - s.shotAt > s.shot * 0.35) {
      const a = (s.shot / CANNONS) * Math.PI * 2 + Math.PI / CANNONS;
      const muzzle = g.localToWorld(tmp.current.v.set(Math.cos(a) * (CONE_R + 0.7), 0.82, Math.sin(a) * (CONE_R + 0.7)));
      smoke.current?.emit(muzzle, 1.4, true);
      // Powder smoke jets out along the barrel, then stalls and climbs.
      const along = tmp.current.d.set(Math.cos(a), 0, Math.sin(a)).transformDirection(g.matrixWorld);
      along.y = 0.12;
      smoke.current?.burst(muzzle, { size: 0.9, dir: along, speed: 8, spread: 0.3, count: 4 });
      sound.boom(0.55);
      // Recoil rocks the car away from the gun.
      s.rockXV -= Math.sin(a) * 0.5;
      s.rockZV += Math.cos(a) * 0.5;
      s.shot++;
      if (s.shot >= CANNONS) {
        s.shot = -1;
        s.nextVolley = s.t + 11;
      }
    }
    // Rocking settles on the springs of the wooden frame (damped).
    s.rockXV += (-40 * s.rockX - 5 * s.rockXV) * dt;
    s.rockZV += (-40 * s.rockZ - 5 * s.rockZV) * dt;
    s.rockX += s.rockXV * dt;
    s.rockZ += s.rockZV * dt;
    if (g) {
      g.position.set(s.x, 0, s.z);
      g.rotation.set(s.rockX * 0.04, s.yaw, s.rockZ * 0.04, "YXZ");
    }

    // Wheel tracks: lay a new point every 30 cm travelled.
    s.trackDist += s.v * dt;
    if ((s.trackDist > 0.3 || !s.filled) && g) {
      s.trackDist = 0;
      [left.current, right.current].forEach((line, k) => {
        if (!line) return;
        const p = g.localToWorld(tmp.current.v.set(k ? -0.95 : 0.95, 0.03, -0.9));
        p.y = 0.03;
        const arr = (line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        if (!s.filled) for (let i = 0; i < TRACK; i++) arr.set([p.x, p.y, p.z], i * 3);
        arr.copyWithin(3, 0, (TRACK - 1) * 3);
        arr.set([p.x, p.y, p.z], 0);
        line.geometry.attributes.position.needsUpdate = true;
      });
      s.filled = true;
    }
    // The wheels grind dust out from under the skirt: more of it the faster
    // the car rolls, left hanging low in its wake.
    s.dust += s.v * dt;
    if (s.dust > 0.55 && g) {
      s.dust = 0;
      const back = tmp.current.d.set(0, 0, -1).transformDirection(g.matrixWorld);
      back.y = 0.3;
      const side = Math.random() < 0.5 ? 1 : -1;
      const at = g.localToWorld(tmp.current.v.set(side * (0.6 + Math.random() * 0.5), 0, -CONE_R * 0.9));
      at.y = 0.15;
      smoke.current?.burst(at, { kind: "dust", size: 0.5, dir: back, speed: 0.9 + s.v, spread: 0.6, count: 2 });
    }
    const sub = subject.current;
    sub.pos.set(s.x, 1.6, s.z);
    sub.yaw = s.yaw;
    sub.look!.set(s.x, 1.5, s.z);
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
      <group ref={tank}>
        <TankModel drive={drive} />
      </group>
      <primitive ref={left} object={lines[0]} />
      <primitive ref={right} object={lines[1]} />
      <Smoke ref={smoke} />
      <FollowCamera subject={subject} view={view} views={VIEWS} minY={0.3} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "III",
  title: "Carro coperto",
  ariaLabel: "The armoured car in three dimensions",
  parts: PARTS,
  overview: { target: [0, 1.6, 0], camera: [7.2, 4.6, 8.2] },
  Model: TankModel,
  rest: 0,
  animate: (t) => t * 2.2,
  voice: (a, was) => rumble(a, was),
  play: ["gira le manovelle", "crank"],
  lift: -0.9,
  extent: 6,
  action: {
    label: "In marcia",
    Scene: MarchScene,
    views: VIEWS,
    start: [10, 6, -14],
    hint: "eight men crank it to walking pace; every so often it fires its cannons round the ring",
  },
};

export default function TankRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
