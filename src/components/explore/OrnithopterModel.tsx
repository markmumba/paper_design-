"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Figure } from "./figure";
import type { Line2 } from "three-stdlib";
import { INK, Look, Part, SPOT, useExplode, useLook, type Drive, type PartDef } from "./kit";

/*
 * The flying machine in three dimensions, built from the same drawing as the
 * 2D folio: the wing outline, spar and finger ribs are the exact curves from
 * the SVG, swept into tubes and a cloth membrane. Everything is ink-outlined
 * on paper-coloured materials so it still reads as a page from the codex.
 */

export const PARTS: PartDef[] = [
  {
    id: "dita",
    label: [2.55, 0.05, 0.2], follow: [0.65, 0, 0],
    italian: "Le dita",
    english: "The fingers",
    text: "A leading spar and four ribs of cane, fanned out like the bones of a bat's hand. Leonardo studied bats because their wing is one continuous skin, not loose feathers that let the air through.",
    target: [2.1, 0.05, 0],
    camera: [2.5, 2.4, 2.3],
  },
  {
    id: "tela",
    label: [1.7, 0.08, -0.85], explode: [0, 0.5, -0.05], follow: [0.65, 0.5, -0.05],
    italian: "La tela",
    english: "The membrane",
    text: "Starched linen or taffeta stretched between the ribs. It billows under load, scalloped between each finger, so the wing can cup the air on the downstroke.",
    target: [2.0, 0, -0.5],
    camera: [2.9, 2.6, -2.9],
  },
  {
    id: "perno",
    label: [0, 0.12, 0], explode: [-0.28, 0, 0], follow: [0.37, 0, 0],
    italian: "Il perno",
    english: "The shoulder pivot",
    text: "Each wing hinges here. All the flier's effort passes through this one joint, which is why Leonardo drew it again and again, reinforced with iron.",
    target: [0.6, 0, 0],
    camera: [1.35, 0.55, 1.35],
  },
  {
    id: "carrucola",
    label: [0, 0.86, 0], explode: [0, 0.6, 0],
    italian: "La carrucola",
    english: "The pulleys",
    text: "Cords run from the wings over pulleys at the top of the mast and down to the flier's hands and feet, turning a push of the legs into a beat of the wings.",
    target: [0, 0.72, 0],
    camera: [0.9, 1.15, 1.15],
  },
  {
    id: "culla",
    label: [0.3, -0.35, -0.45], explode: [0, -0.55, 0],
    italian: "La culla",
    english: "The cradle",
    text: "The flier lay face down in this trough, pedalling stirrups at the back. Lying flat kept the body out of the wind and put the strongest muscles, the legs, to work.",
    target: [0, -0.3, 0],
    camera: [1.5, -0.35, 1.9],
  },
  {
    id: "uomo",
    label: [0, -0.06, 0.62], explode: [0, -1.15, 0.1],
    italian: "L'uomo",
    english: "The flier",
    text: "The engine of the whole machine. Leonardo calculated what a man could lift and push, and in later notebooks admitted that muscle alone was too weak to fly this way, turning instead to gliding on the wind.",
    target: [0, -0.18, 0.1],
    camera: [1.25, 0.35, 1.7],
  },
  {
    id: "timone",
    label: [0, 0.06, -2.15], explode: [0, 0, -0.8],
    italian: "Il timone",
    english: "The tail rudder",
    text: "A fan of cloth on ribs, worked by a cord at the flier's head, to steer and to pitch the nose up or down, as a bird spreads and tilts its tail.",
    target: [0, -0.02, -1.5],
    camera: [1.15, 0.65, -2.65],
  },
  {
    id: "albero",
    label: [0, 0.02, 1.25],
    italian: "L'albero",
    english: "Mast and keel",
    text: "The spine of the machine: a keel running nose to tail, a crossbar carrying both wings, and an upright mast for the pulleys.",
    target: [0, 0.1, -0.2],
    camera: [1.7, 0.9, 2.5],
  },
];

export const OVERVIEW = { target: [0, 0, -0.2] as [number, number, number], camera: [4.6, 3.3, 6.2] as [number, number, number] };

// ── Geometry, from the folio's SVG curves ───────────────────────────────────────
const S = 3 / 244; // the 2D wing is 244 units long; in 3D it is 3 m
const v = (sx: number, sy: number) => new THREE.Vector3(sx * S, 0, -sy * S);

const SPAR = new THREE.CubicBezierCurve3(v(0, 0), v(70, -26), v(160, -34), v(244, -14));
const RIBS = [
  [v(10, -4), v(130, -8), v(236, 26)],
  [v(8, 0), v(110, 20), v(196, 70)],
  [v(6, 3), v(80, 38), v(140, 96)],
  [v(4, 5), v(40, 46), v(76, 104)],
].map(([a, c, b]) => new THREE.QuadraticBezierCurve3(a, c, b));

/*
 * The cloth: a real surface spanning the leading spar and the scalloped
 * trailing edge, gridded so it can bend. It billows with a resting sag, and
 * each wingbeat presses it the other way: air pushes the canvas up on the
 * downstroke and down on the upstroke, then it snaps back.
 */
const CLOTH_U = 46;
const CLOTH_V = 14;
const P2 = (x: number, y: number) => new THREE.Vector2(x * S, y * S);
const LEAD = new THREE.CubicBezierCurve(P2(0, 0), P2(70, -26), P2(160, -34), P2(244, -14));
const TRAIL_EDGE = (() => {
  const path = new THREE.CurvePath<THREE.Vector2>();
  const pts: [number, number, number, number][] = [
    [248, 8, 236, 26],
    [220, 52, 196, 70],
    [172, 92, 140, 96],
    [108, 106, 76, 104],
    [38, 92, 6, 30],
  ];
  let from = P2(244, -14);
  for (const [cx, cy, x, y] of pts) {
    const to = P2(x, y);
    path.add(new THREE.QuadraticBezierCurve(from, P2(cx, cy), to));
    from = to;
  }
  path.add(new THREE.LineCurve(from, P2(0, 0)));
  return path;
})();

/** Billow weight: zero along the spar and edges, deepest mid-panel. */
const clothWeight = (u: number, v: number) => Math.sin(Math.PI * v) * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.12)));

function clothGrid() {
  const n = (CLOTH_U + 1) * (CLOTH_V + 1);
  const pos = new Float32Array(n * 3);
  const weight = new Float32Array(n);
  for (let iu = 0; iu <= CLOTH_U; iu++) {
    const u = iu / CLOTH_U;
    const a = LEAD.getPointAt(u);
    const b = TRAIL_EDGE.getPointAt(1 - u);
    for (let iv = 0; iv <= CLOTH_V; iv++) {
      const v = iv / CLOTH_V;
      const k = iu * (CLOTH_V + 1) + iv;
      pos[k * 3] = a.x + (b.x - a.x) * v;
      pos[k * 3 + 2] = -(a.y + (b.y - a.y) * v);
      weight[k] = clothWeight(u, v);
    }
  }
  const index: number[] = [];
  for (let iu = 0; iu < CLOTH_U; iu++) {
    for (let iv = 0; iv < CLOTH_V; iv++) {
      const a = iu * (CLOTH_V + 1) + iv;
      const b = a + CLOTH_V + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  // The outline: leading edge out to the tip, trailing edge back to the root.
  const outline: number[] = [];
  for (let iu = 0; iu <= CLOTH_U; iu++) outline.push(iu * (CLOTH_V + 1));
  for (let iu = CLOTH_U; iu >= 0; iu--) outline.push(iu * (CLOTH_V + 1) + CLOTH_V);
  return { geo, weight, outline };
}

const REST_SAG = -0.075;

/** Shape the cloth for a given gust (positive pushes it up). */
function shapeCloth(geo: THREE.BufferGeometry, weight: Float32Array, gust: number, outline: number[], line: Float32Array) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let k = 0; k < weight.length; k++) arr[k * 3 + 1] = (REST_SAG + gust) * weight[k];
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  outline.forEach((k, i) => {
    line[i * 3] = arr[k * 3];
    line[i * 3 + 1] = arr[k * 3 + 1] + 0.002;
    line[i * 3 + 2] = arr[k * 3 + 2];
  });
}

function rudderGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = -0.5 + (i / n) * 1.0;
    shape.lineTo(Math.sin(a) * 0.78, Math.cos(a) * 0.78);
  }
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// ── The machine ──────────────────────────────────────────────────────────────
type FlapSource = Drive;

function Cloth({ flap }: { flap: FlapSource }) {
  const { lit, dimmed } = useLook();
  const grid = useMemo(() => clothGrid(), []);
  const mesh = useRef<THREE.Mesh>(null);
  const line = useRef<Line2>(null);
  const linePts = useMemo(() => new Float32Array(grid.outline.length * 3), [grid]);
  const state = useRef({ a: flap.current, gust: 0, first: true });
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const st = state.current;
    const vel = (flap.current - st.a) / Math.max(dt, 1 / 240);
    st.a = flap.current;
    // Wing going down (angle falling) → air presses the canvas up, and v.v.
    const target = Math.max(-0.13, Math.min(0.13, -vel * 0.045));
    st.gust += (target - st.gust) * Math.min(1, dt * 9);
    if (Math.abs(st.gust) < 0.0005 && !st.first) return;
    st.first = false;
    shapeCloth(m.geometry, grid.weight, st.gust, grid.outline, linePts);
    line.current?.geometry.setPositions(linePts);
  });
  const outlinePoints = useMemo(() => {
    const g = clothGrid();
    shapeCloth(g.geo, g.weight, 0, g.outline, linePts);
    return Array.from({ length: g.outline.length }, (_, i) => new THREE.Vector3(linePts[i * 3], linePts[i * 3 + 1], linePts[i * 3 + 2]));
  }, [linePts]);
  return (
    <>
      <mesh ref={mesh} geometry={grid.geo} castShadow>
        <Look kind="cloth" edges={false} />
      </mesh>
      {/* The inner panel is printed in the spot colour, as on the folio. */}
      <mesh geometry={grid.geo} scale={[0.42, 1, 0.55]} position={[0, -0.004, -0.05]}>
        <Look kind="spot" edges={false} />
      </mesh>
      <Line ref={line} points={outlinePoints} color={lit ? SPOT : INK} lineWidth={lit ? 2.4 : 1.7} transparent opacity={dimmed ? 0.12 : 0.9} />
    </>
  );
}

const FINE_RIBS = [
  [v(9, -2), v(120, 6), v(216, 48)],
  [v(7, 1), v(95, 30), v(168, 84)],
  [v(5, 4), v(60, 42), v(108, 102)],
].map(([a, c, b]) => new THREE.QuadraticBezierCurve3(a, c, b));

function Wing({ side, flap }: { side: 1 | -1; flap: FlapSource }) {
  const ref = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Group>(null);
  const explode = useExplode();
  const labelled = side === 1;
  const geo = useMemo(
    () => ({
      spar: new THREE.TubeGeometry(SPAR, 40, 0.032, 6, false),
      ribs: RIBS.map((c) => new THREE.TubeGeometry(c, 30, 0.018, 6, false)),
      fine: FINE_RIBS.map((c) => new THREE.TubeGeometry(c, 24, 0.007, 4, false)),
      hinge: new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12),
      joints: [SPAR.getPoint(0.3), SPAR.getPoint(0.62)],
    }),
    [],
  );
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = side * flap.current;
    if (outer.current) outer.current.position.x = side * (0.6 + 0.65 * explode.current);
  });
  return (
    <group ref={outer} position={[side * 0.6, 0, 0]} scale={[side, 1, 1]}>
      <group ref={ref}>
        <Part id="tela" labelled={labelled}>
          <Cloth flap={flap} />
        </Part>
        <Part id="dita" labelled={labelled}>
          <mesh geometry={geo.spar} castShadow>
            <Look kind="cane" />
          </mesh>
          {geo.ribs.map((g, i) => (
            <mesh key={i} geometry={g} castShadow>
              <Look kind="cane" />
            </mesh>
          ))}
          {geo.fine.map((g, i) => (
            <mesh key={`f${i}`} geometry={g}>
              <Look kind="cane" />
            </mesh>
          ))}
          {geo.joints.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <Look kind="metal" />
            </mesh>
          ))}
        </Part>
        <Part id="perno" labelled={labelled}>
          <mesh geometry={geo.hinge} rotation={[Math.PI / 2, 0, 0]}>
            <Look kind="metal" />
          </mesh>
        </Part>
      </group>
    </group>
  );
}

/** Cords from the mast-top pulley to each wing, recomputed as the wings move. */
const CORD_ANCHOR = SPAR.getPoint(0.36);
function Cords({ flap }: { flap: FlapSource }) {
  const explode = useExplode();
  const ref = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(4 * 3), []);
  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    const a = flap.current;
    const { x: ax, y: ay, z: az } = CORD_ANCHOR;
    // Wing point after the hinge rotation (mirrored for the left wing).
    const x = ax * Math.cos(a) - ay * Math.sin(a);
    const y = ax * Math.sin(a) + ay * Math.cos(a);
    // Follow the wings and the pulley when the machine is exploded.
    const reach = 0.6 + 0.65 * explode.current + x;
    const top = 0.74 + 0.6 * explode.current;
    pos.setXYZ(0, 0, top, 0);
    pos.setXYZ(1, reach, y, az);
    pos.setXYZ(2, 0, top, 0);
    pos.setXYZ(3, -reach, y, az);
    pos.needsUpdate = true;
  });
  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={INK} transparent opacity={0.85} />
    </lineSegments>
  );
}

/*
 * The flier: the same anatomical man as the crew of the aerial screw, lying
 * face down in the cradle at three-quarter scale, hands forward on the cords
 * and feet in the stirrups. His own frame (feet at the origin, facing +X,
 * up +Y) is turned so his head points forward (+Z) and his face down (-Y).
 */
const FLIER_SCALE = 0.75;
const FLIER_AT = new THREE.Vector3(0, -0.2, -0.78);
const FLIER_TURN = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)),
);
/** A point on the machine, in the flier's own frame. */
const toFlier = (x: number, y: number, z: number) =>
  new THREE.Vector3(x, y, z).sub(FLIER_AT).applyQuaternion(FLIER_TURN.clone().invert()).divideScalar(FLIER_SCALE);
const FLIER_HANDS: [THREE.Vector3, THREE.Vector3] = [toFlier(0.24, -0.06, 0.62), toFlier(-0.24, -0.06, 0.62)];
// Left foot first: his left (+Z in his frame) is the machine's -X.
const FLIER_FEET: [THREE.Vector3, THREE.Vector3] = [toFlier(-0.12, -0.34, -0.76), toFlier(0.12, -0.34, -0.76)];

function Flier() {
  return (
    <group position={FLIER_AT} quaternion={FLIER_TURN} scale={FLIER_SCALE}>
      <Figure lean={0} hands={FLIER_HANDS} feet={FLIER_FEET} />
    </group>
  );
}

export function Ornithopter3D({ drive }: { drive: Drive }) {
  const flap = drive;
  const geo = useMemo(() => {
    const cradle = new THREE.CylinderGeometry(0.27, 0.27, 1.3, 20, 1, true, -Math.PI / 2, Math.PI);
    cradle.rotateX(Math.PI / 2);
    return { cradle, rudder: rudderGeometry() };
  }, []);
  return (
      <group>
        <Wing side={1} flap={flap} />
        <Wing side={-1} flap={flap} />
        <Cords flap={flap} />

        <Part id="albero">
          {/* Keel, nose to tail. */}
          <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.03, 2.7, 8]} />
            <Look kind="wood" />
          </mesh>
          {/* Crossbar carrying the wings. */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
            <Look kind="wood" />
          </mesh>
          {/* Mast. */}
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.035, 1.2, 8]} />
            <Look kind="wood" />
          </mesh>
          {/* Nose cap. */}
          <mesh position={[0, 0, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.05, 0.14, 10]} />
            <Look kind="metal" />
          </mesh>
        </Part>

        <Part id="carrucola">
          {[0.74, -0.42].map((y, i) => (
            <group key={y} position={[0, y, 0]}>
              <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[i ? 0.06 : 0.09, 0.022, 8, 20]} />
                <Look kind="metal" />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.015, 0.015, 0.14, 6]} />
                <Look kind="metal" />
              </mesh>
            </group>
          ))}
        </Part>

        <Part id="culla">
          <mesh geometry={geo.cradle} position={[0, -0.12, 0]} castShadow>
            <Look kind="cloth" />
          </mesh>
          {[-0.55, 0, 0.55].map((z) => (
            <mesh key={z} position={[0, -0.12, z]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.27, 0.014, 6, 24, Math.PI]} />
              <Look kind="wood" />
            </mesh>
          ))}
          {/* Stirrups the flier pedalled. */}
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, -0.36, -0.78]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.06, 0.012, 6, 16]} />
              <Look kind="metal" />
            </mesh>
          ))}
        </Part>

        <Part id="uomo">
          <Flier />
        </Part>

        <Part id="timone">
          <mesh geometry={geo.rudder} position={[0, 0, -1.52]}>
            <Look kind="spot" />
          </mesh>
          {[-0.4, -0.13, 0.13, 0.4].map((a) => (
            <mesh key={a} position={[Math.sin(a) * 0.39, 0, -1.52 - Math.cos(a) * 0.39]} rotation={[Math.PI / 2, 0, a]}>
              <cylinderGeometry args={[0.012, 0.012, 0.78, 5]} />
              <Look kind="cane" />
            </mesh>
          ))}
        </Part>
      </group>
  );
}
