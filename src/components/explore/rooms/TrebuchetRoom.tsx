"use client";

import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { stepped } from "@/components/cues";
import { sound } from "@/lib/sound";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "../ExploreRoom";
import { Beam, INK, Look, Part, SPOT, type Drive, type PartDef } from "../kit";
import { Cloud, Coastline, Field, Sky, Smoke, type SmokeHandle } from "../scenery";
import { AXLE, COCK, cocked, HC, LA, LB, points, SL, step, STONE_Y } from "../trebuchet";

/*
 * Folio V in three dimensions: the trebuchet.
 *
 * The throw is simulated, not animated: see ../trebuchet for the dynamics.
 * A 260 kg arm on an axle, a hinged counterweight of 1.8 tonnes, a 4 m sling
 * and an 18 kg stone. The counterweight falls, the sling drags the stone
 * back along its trough, lifts it and whips it over the top; the sling's loop
 * slips off its prong, and from that instant nothing joins the stone to the
 * machine. It flies about 185 m in six seconds, losing a little to the air.
 * The castle is placed where that very stone comes down.
 */

const P = new THREE.Vector2(AXLE.z, AXLE.y); // axle, as (z, y)

/** Run a whole throw once to learn where the stone flies (to build the castle there). */
function rehearse() {
  const s = cocked();
  const path: [number, number][] = [];
  for (let i = 0; i < 60 * 14; i++) {
    step(s, 1 / 60);
    if (s.phase === "flight") path.push([s.stone.z, s.stone.y]);
    if (s.phase === "flight" && s.stone.y <= 0) break;
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

type ZY = { z: number; y: number };
/**
 * A: arm tip. B: counterweight hinge. C: foot of the hanger, where the box
 * hangs. S: the sling's free end. `rock` is the stone once it has left the
 * sling (until then it rides at S); `stone` is whether it is still in one piece.
 */
export type Pose = { A: ZY; B: ZY; C: ZY; S: ZY; rock?: ZY; stone: boolean };

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
    if (weight.current) {
      // The box is rigid with its hanger, so it swings with it.
      weight.current.position.set(0, p.C.y, p.C.z);
      weight.current.rotation.x = Math.atan2(p.B.z - p.C.z, p.B.y - p.C.y);
    }
    if (stone.current) {
      const at = p.rock ?? p.S;
      stone.current.position.set(0, at.y, at.z);
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
    // The sling runs to its own end, never to a stone that has left it.
    set(sling.current, p.A, p.S);
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

const TRAIL = 420;
const smooth = (k: number) => k * k * (3 - 2 * k);
/** The same direction, as the angle nearest to `near`. */
const nearest = (a: number, near: number) => near + Math.atan2(Math.sin(a - near), Math.cos(a - near));

function ThrowScene({ view }: { view: string }) {
  const { wallZ } = useMemo(() => rehearse(), []);
  const smoke = useRef<SmokeHandle>(null);
  const drive = useRef(0);
  const pose = useRef<Pose>({ ...poseFor(COCK), stone: true });
  const sim = useRef({ s: cocked(), phase: "ready" as "ready" | "throw" | "after" | "cock", t: 0, acc: 0, lastZ: 0, from: [COCK, -Math.PI / 2, -Math.PI / 2] as [number, number, number] });
  const chunks = useRef<THREE.Group>(null);
  const debris = useRef(Array.from({ length: DEBRIS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), on: false })));
  const subject = useRef<Subject>({ pos: new THREE.Vector3(), yaw: 0, look: new THREE.Vector3() });
  // The stone's path, pricked out in ink as it flies, the way Leonardo drew his shots.
  const trail = useMemo(() => {
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    geo.setDrawRange(0, 0);
    const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: INK, size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.55 }));
    dots.frustumCulled = false;
    return dots;
  }, []);
  const dots = useRef<THREE.Points>(null);
  const pricked = useRef({ n: 0, every: 0 });
  // What the sound cues need to remember: where the sling's end was, how the
  // arm and the box were last swinging and how hard, and the winding's progress.
  const heard = useRef({ y: 0, w: [0, 0], peak: [0, 0], theta: COCK, laid: true });

  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 1 / 20);
    const m = sim.current;
    m.t += dt;
    const s = m.s;
    if (m.phase === "ready" && m.t > 2.5) {
      m.phase = "throw";
      m.t = 0;
      m.lastZ = points(s).S.z;
      heard.current = { y: points(s).S.y, w: [0, 0], peak: [0, 0], theta: COCK, laid: true };
      pricked.current = { n: 0, every: 0 };
      dots.current?.geometry.setDrawRange(0, 0);
      sound.clatter();
    }
    if (m.phase === "throw" || m.phase === "after") {
      m.acc += dt;
      while (m.acc >= 1 / 60) {
        m.acc -= 1 / 60;
        if (step(s, 1 / 60) === "release") sound.twang(0.7);
        const now = points(s);
        // While the sling still drags the stone along its trough, it scrapes up dust.
        const scrape = now.S.z - m.lastZ;
        m.lastZ = now.S.z;
        const ear = heard.current;
        // Stone grinding along the trough for as long as it is dragged, then
        // the air round the sling, rising with the stone's speed until it is let go.
        const pace = Math.hypot(scrape, now.S.y - ear.y) * 60; // metres per second
        ear.y = now.S.y;
        if (s.phase === "trough" && Math.abs(scrape) > 0.001) sound.scrape(pace / 6);
        if (s.phase === "sling") sound.whoosh(pace / 45, 0.22);
        if (s.phase === "flight") {
          // Afterwards the arm and the box rock themselves still, and the
          // timber creaks each time one of them stops and swings back, as
          // loudly as it was swinging.
          for (let i = 0; i < 2; i++) {
            ear.peak[i] = Math.max(ear.peak[i], Math.abs(s.w[i]));
            if (s.w[i] * ear.w[i] < 0) {
              if (ear.peak[i] > 0.25) sound.creak(ear.peak[i] / 2.5);
              ear.peak[i] = 0;
            }
            ear.w[i] = s.w[i];
          }
        }
        if (s.phase === "trough" && Math.abs(scrape) > 0.001 && Math.random() < 0.18) {
          smoke.current?.burst(new THREE.Vector3(0, 0.15, now.S.z), { kind: "dust", size: 0.9, dir: new THREE.Vector3(0, 0.4, -Math.sign(scrape)), speed: 2, spread: 0.6, count: 2 });
        }
        const rock = s.stone;
        if (s.phase === "flight" && pose.current.stone) {
          // One dot every twentieth of a second of flight.
          const ink = pricked.current;
          const geo = dots.current?.geometry;
          if (geo && ink.every++ % 3 === 0 && ink.n < TRAIL) {
            const at = geo.attributes.position as THREE.BufferAttribute;
            at.setXYZ(ink.n++, 0, rock.y, rock.z);
            at.needsUpdate = true;
            geo.setDrawRange(0, ink.n);
          }
          // The stone strikes the wall, or the ground.
          if (rock.y <= 0.2 || (rock.z >= wallZ - 1.5 && rock.y < 9.2)) {
            pose.current.stone = false;
            const hit = new THREE.Vector3(0, Math.max(0.5, rock.y), Math.min(rock.z, wallZ - 1.5));
            // Against the wall the dust is thrown back off the stonework and
            // rolls down it; in the field it goes up and on with the stone.
            const atWall = rock.y > 0.2;
            smoke.current?.burst(hit, { size: 5, dir: new THREE.Vector3(0, atWall ? 0.5 : 1, atWall ? -1 : 0.5), speed: 4.5, spread: 0.8, count: 8 });
            smoke.current?.burst(hit.clone().setY(0.4), { kind: "dust", size: 3.5, dir: new THREE.Vector3(0, 0.2, -1), speed: 3, spread: 0.9, count: 5 });
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
      }
      if (m.phase === "after" && m.t > 4) {
        m.phase = "cock";
        m.t = 0;
        m.from = [s.q[0], s.q[1], s.q[2]];
        heard.current.theta = s.q[0];
        heard.current.laid = false;
      }
    }
    if (m.phase === "cock") {
      // The crew steady the swinging box and sling, then wind the arm back
      // down with the winch and lay a new stone in the trough.
      const k = Math.min(1, m.t / 4);
      const [th0, ph0, ps0] = m.from;
      const theta = th0 + (nearest(COCK, th0) - th0) * smooth(k);
      const still = smooth(Math.min(1, k / 0.3));
      const pp = poseFor(theta);
      const ph = ph0 + (nearest(-Math.PI / 2, ph0) - ph0) * still;
      const ps = ps0 + (nearest(-Math.PI / 2, ps0) - ps0) * still;
      const swung = { z: pp.A.z + SL * Math.cos(ps), y: pp.A.y + SL * Math.sin(ps) };
      pose.current = {
        A: pp.A,
        B: pp.B,
        C: { z: pp.B.z + HC * Math.cos(ph), y: pp.B.y + HC * Math.sin(ph) },
        // Once it hangs still, the sling follows the tip down and is laid out along the trough.
        S: still < 1 ? { z: swung.z + (pp.S.z - swung.z) * still, y: Math.max(STONE_Y, swung.y + (pp.S.y - swung.y) * still) } : pp.S,
        stone: k > 0.85,
      };
      // The winch knocks for every 0.2 rad the arm is wound down, so it
      // quickens and slows with the arm; the new stone thuds into the trough.
      const ear = heard.current;
      if (stepped(ear.theta, theta, 0.2)) sound.knock();
      ear.theta = theta;
      if (k > 0.85 && !ear.laid) {
        ear.laid = true;
        sound.thud(0.35);
      }
      if (k >= 1) {
        m.s = cocked();
        m.phase = "ready";
        m.t = 0;
      }
    } else {
      const now = points(s);
      pose.current = { A: now.A, B: now.B, C: now.C, S: now.S, rock: s.phase === "flight" ? now.stone : undefined, stone: m.phase === "ready" ? true : pose.current.stone };
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
      const at = pose.current.rock ?? pose.current.S;
      sub.pos.set(0, Math.max(1, at.y), at.z);
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
      <primitive ref={dots} object={trail} />
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
  // The axle creaks each time the arm stops and swings back.
  voice: (a, was, before) => {
    if ((was - before) * (a - was) < 0) sound.creak(0.6);
  },
  play: ["muovi il braccio", "swing"],
  lift: -0.88,
  extent: 8,
  action: {
    label: "Il lancio",
    Scene: ThrowScene,
    views: VIEWS,
    start: [26, 8, -4],
    far: 900,
    hint: "simulated, not animated: the weight falls, the sling whips over, its loop slips the prong and the stone flies free, 185 m in six seconds",
  },
};

export default function TrebuchetRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
