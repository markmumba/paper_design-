"use client";

import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Look, useLook, type Drive, type Kind } from "./kit";

/*
 * A Renaissance working man, built to human proportions (about 1.7 m): bare
 * to the waist, sun-browned, in linen shorts tied with a cord.
 *
 * Each limb is one smooth tapered form, with the masses that shape a real
 * arm or leg laid over it (biceps and triceps, the forearm's bulk below the
 * elbow, the teardrop of muscle above the knee, the calf), and rounded joints
 * so elbows and knees never pinch. The torso is modelled the same way: chest,
 * pectorals, a lightly marked belly, lats and shoulder blades, a muscled neck
 * and a proper head with jaw, chin, nose, brow, ears and hair.
 *
 * Arms and legs are solved with two-bone inverse kinematics, so the hands
 * close on what they hold and the knees and elbows bend the right way.
 *
 * Local frame: feet at the origin, facing +X, up +Y, left +Z.
 */

type V = THREE.Vector3;
type T3 = [number, number, number];
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const HIP = 0.9;
const SHOULDER = 1.42;
const THIGH = 0.46;
const SHIN = 0.45;
const UPPER_ARM = 0.3;
const FOREARM = 0.29;

const CONTOUR = "#6a4027";

/** One unit sphere, shared: every rounded form is this, stretched. */
const BALL = new THREE.SphereGeometry(1, 22, 16);

/**
 * A limb: a closed, smooth tapered form from radius 1 at the top (local
 * y = -1) to `taper` at the bottom (y = 1), swelling by `swell` where the
 * muscle is fullest (`peak`, 0 top to 1 bottom).
 */
function limb(taper: number, swell: number, peak: number) {
  const pts: THREE.Vector2[] = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const body = 1 + (taper - 1) * t + swell * Math.exp(-(((t - peak) / 0.28) ** 2));
    // Round both ends over so the form closes like flesh, not a cut tube.
    const cap = Math.sqrt(Math.min(1, Math.min(t, 1 - t) / 0.08));
    pts.push(new THREE.Vector2(Math.max(0.001, body * cap), -1 + 2 * t));
  }
  return new THREE.LatheGeometry(pts, 22);
}
const UPPER_ARM_G = limb(0.74, 0.12, 0.42);
const FOREARM_G = limb(0.55, 0.12, 0.2);
const THIGH_G = limb(0.6, 0.06, 0.3);
const SHIN_G = limb(0.5, 0.14, 0.22);
const SHORTS_G = limb(0.92, 0.02, 0.4);

/** Two-bone IK: where the middle joint goes, bending towards `pole`. */
function solve(root: V, end: V, a: number, b: number, pole: V) {
  const dir = end.clone().sub(root);
  const d = Math.min(dir.length(), a + b - 0.001);
  dir.normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const bend = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return root.clone().add(dir.multiplyScalar(x)).add(bend.multiplyScalar(h));
}

const basis = new THREE.Matrix4();
/**
 * Lay a form along the bone from a to b: it fills the stretch t0..t1 of the
 * bone, is rx thick across and rz deep, and sits `push` towards `side`.
 */
function along(obj: THREE.Object3D | null | undefined, a: V, b: V, t0: number, t1: number, rx: number, rz: number, side?: V, push = 0) {
  if (!obj) return;
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  let z = side ? side.clone().sub(dir.clone().multiplyScalar(side.dot(dir))) : v3();
  if (z.lengthSq() < 1e-6) z = Math.abs(dir.y) < 0.9 ? v3(0, 1, 0).cross(dir) : v3(1, 0, 0).cross(dir);
  z.normalize();
  const x = v3().crossVectors(dir, z);
  basis.makeBasis(x, dir, z);
  obj.quaternion.setFromRotationMatrix(basis);
  obj.position.copy(a).addScaledVector(dir, (len * (t0 + t1)) / 2).addScaledVector(z, push);
  obj.scale.set(rx, (len * (t1 - t0)) / 2, rz);
}

/** A round joint at p. */
function joint(obj: THREE.Object3D | null | undefined, p: V, r: number) {
  if (!obj) return;
  obj.position.copy(p);
  obj.scale.setScalar(r);
}

/**
 * The ink contour round a form: the same shape a touch larger, drawn only
 * from behind, so it shows as a line where the form turns away. Only the main
 * forms carry one; the muscles laid over them melt into the skin.
 */
function Contour({ geometry, scale = [1.05, 1.015, 1.05] }: { geometry: THREE.BufferGeometry; scale?: T3 }) {
  const { dimmed } = useLook();
  return (
    <mesh geometry={geometry} scale={scale}>
      <meshBasicMaterial color={CONTOUR} side={THREE.BackSide} transparent={dimmed} opacity={dimmed ? 0.12 : 1} />
    </mesh>
  );
}

type Register = (name: string, mesh: THREE.Mesh | null) => void;

/** A form placed every frame by name. */
function Moving({
  kind,
  name,
  register,
  geometry = BALL,
  outline,
}: {
  kind: Kind;
  name: string;
  register: Register;
  geometry?: THREE.BufferGeometry;
  outline?: boolean;
}) {
  return (
    <mesh ref={(o) => register(name, o)} geometry={geometry} castShadow>
      <Look kind={kind} edges={false} />
      {outline && <Contour geometry={geometry} />}
    </mesh>
  );
}

// ── The torso, head and shorts ────────────────────────────────────────────────
/** kind, position, size, rotation, outlined */
type Fixed = [Kind, T3, T3, T3?, boolean?];
/** Each listed form on the left (+Z), and its mirror image on the right. */
const mirror = (parts: Fixed[]): Fixed[] =>
  parts.flatMap(([k, [x, y, z], s, r, o]) => [
    [k, [x, y, z], s, r, o] as Fixed,
    [k, [x, y, -z], s, r ? ([-r[0], -r[1], r[2]] as T3) : undefined, o] as Fixed,
  ]);

const TORSO: Fixed[] = [
  // Chest, belly and the back of the neck.
  ["flesh", [0, 1.255, 0], [0.122, 0.165, 0.152], undefined, true],
  ["flesh", [0.004, 1.09, 0], [0.108, 0.125, 0.138], undefined, true],
  ["flesh", [-0.058, 1.415, 0], [0.05, 0.1, 0.15]],
  ["flesh", [-0.004, 1.515, 0], [0.054, 0.085, 0.056]],
  // The head: skull, jaw, chin, nose and brow, and a crop of hair.
  ["flesh", [0.006, 1.672, 0], [0.092, 0.104, 0.083], undefined, true],
  ["flesh", [0.046, 1.61, 0], [0.062, 0.05, 0.066]],
  ["flesh", [0.087, 1.58, 0], [0.022, 0.022, 0.03]],
  ["flesh", [0.097, 1.646, 0], [0.018, 0.029, 0.012], [0, 0, -0.25]],
  ["flesh", [0.082, 1.69, 0], [0.014, 0.012, 0.064]],
  ["hair", [-0.018, 1.705, 0], [0.091, 0.082, 0.087], [0, 0, 0.2], true],
  // Linen shorts over the hips, tied with a cord at the waist.
  ["linen", [0, 0.94, 0], [0.127, 0.118, 0.176], undefined, true],
  ["cord", [0.002, 1.035, 0], [0.118, 0.016, 0.166]],
  ...mirror([
    // Pectorals and the light marking of the belly.
    ["flesh", [0.084, 1.33, 0.078], [0.05, 0.075, 0.085], [0.25, 0, 0]],
    ...[1.06, 1.12, 1.18].map((y): Fixed => ["flesh", [0.1, y, 0.034], [0.016, 0.03, 0.035]]),
    // Flank, lats and the shoulder blade.
    ["flesh", [0.025, 1.08, 0.112], [0.06, 0.11, 0.05], [0, 0, -0.45]],
    ["flesh", [-0.048, 1.2, 0.108], [0.052, 0.17, 0.07], [0.22, 0, 0]],
    ["flesh", [-0.098, 1.31, 0.078], [0.028, 0.075, 0.05], [1.2, 0, 0]],
    ["flesh", [-0.106, 1.13, 0.03], [0.03, 0.15, 0.032]],
    // Deltoid, capping the shoulder.
    ["flesh", [0.004, 1.375, 0.205], [0.06, 0.1, 0.058], [-0.2, 0, 0]],
    // The straps of the neck, from behind the ear to the breastbone.
    ["flesh", [0.038, 1.515, 0.03], [0.021, 0.066, 0.021], [0.25, 0, -0.5]],
    // Ears and eyes.
    ["flesh", [-0.004, 1.652, 0.084], [0.02, 0.032, 0.009]],
    ["iron", [0.086, 1.668, 0.03], [0.009, 0.008, 0.01]],
  ]),
];

/**
 * The torso never moves relative to itself, so its forms are baked into one
 * mesh per material (and one for the outlined forms' contour), shared by
 * every figure: a handful of draw calls instead of dozens.
 */
type Baked = { kind: Kind; geometry: THREE.BufferGeometry; contour?: THREE.BufferGeometry };
let baked: Baked[] | null = null;
function torso(): Baked[] {
  if (baked) return baked;
  const groups = new Map<Kind, { forms: THREE.BufferGeometry[]; outlines: THREE.BufferGeometry[] }>();
  for (const [kind, pos, scale, rot = [0, 0, 0], outline] of TORSO) {
    const e = groups.get(kind) ?? { forms: [], outlines: [] };
    groups.set(kind, e);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
    const at = new THREE.Vector3(...pos);
    e.forms.push(BALL.clone().applyMatrix4(new THREE.Matrix4().compose(at, q, new THREE.Vector3(...scale))));
    if (outline) {
      const big = new THREE.Vector3(scale[0] + 0.006, scale[1] + 0.004, scale[2] + 0.006);
      e.outlines.push(BALL.clone().applyMatrix4(new THREE.Matrix4().compose(at, q, big)));
    }
  }
  baked = [...groups].map(([kind, { forms, outlines }]) => ({
    kind,
    geometry: mergeGeometries(forms),
    contour: outlines.length ? mergeGeometries(outlines) : undefined,
  }));
  return baked;
}

function BakedContour({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { dimmed } = useLook();
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={CONTOUR} side={THREE.BackSide} transparent={dimmed} opacity={dimmed ? 0.12 : 1} />
    </mesh>
  );
}

// ── The limbs ─────────────────────────────────────────────────────────────────
type LimbForm = { name: string; kind: Kind; geometry?: THREE.BufferGeometry; outline?: boolean };
const LIMB_FORMS: LimbForm[] = [
  { name: "upper", kind: "flesh", geometry: UPPER_ARM_G, outline: true },
  { name: "bic", kind: "flesh" },
  { name: "tri", kind: "flesh" },
  { name: "elbow", kind: "flesh" },
  { name: "fore", kind: "flesh", geometry: FOREARM_G, outline: true },
  { name: "brach", kind: "flesh" },
  { name: "wrist", kind: "flesh" },
  { name: "palm", kind: "flesh", outline: true },
  { name: "fingers", kind: "flesh" },
  { name: "thumb", kind: "flesh" },
  { name: "thigh", kind: "flesh", geometry: THIGH_G, outline: true },
  { name: "vastus", kind: "flesh" },
  { name: "knee", kind: "flesh" },
  { name: "shin", kind: "flesh", geometry: SHIN_G, outline: true },
  { name: "calf", kind: "flesh" },
  { name: "ankle", kind: "flesh" },
  { name: "foot", kind: "flesh", outline: true },
  { name: "heel", kind: "flesh" },
  { name: "shorts", kind: "linen", geometry: SHORTS_G, outline: true },
];

export type FigureProps = {
  /** Lean forward (radians), as when pushing. */
  lean?: number;
  /** Where the hands grip, in the figure's local frame. */
  hands: [V, V];
  /** Distance walked (metres); drives the stride. Omit to stand still. */
  walked?: Drive;
  /** Fixed foot positions instead of standing or walking (e.g. in stirrups). */
  feet?: [V, V];
};

export function Figure({ lean = 0.32, hands, walked, feet }: FigureProps) {
  const refs = useRef<Record<string, THREE.Mesh | null>>({});
  const register = useCallback<Register>((name, mesh) => {
    refs.current[name] = mesh;
  }, []);

  // The upper body pivots forward about the ankles.
  const tilt = useMemo(() => new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), -lean), [lean]);
  const body = useMemo(() => {
    const L = (p: V) => p.clone().applyQuaternion(tilt);
    const shL = L(v3(0, SHOULDER - 0.02, 0.2));
    const shR = L(v3(0, SHOULDER - 0.02, -0.2));
    // Each hand goes to the shoulder on its own side (left is +Z), so the
    // arms never cross however the grips are listed.
    const [handL, handR] = hands[0].z >= hands[1].z ? hands : [hands[1], hands[0]];
    return {
      hipL: L(v3(0, HIP, 0.1)),
      hipR: L(v3(0, HIP, -0.1)),
      shL,
      shR,
      // Elbows bend down and out, as when pushing a bar.
      elL: solve(shL, handL, UPPER_ARM, FOREARM, v3(-0.3, -1, 0.6)),
      elR: solve(shR, handR, UPPER_ARM, FOREARM, v3(-0.3, -1, -0.6)),
      handL,
      handR,
    };
  }, [hands, tilt]);

  // Arms are fixed relative to the body, so dress them once.
  const armsPlaced = useRef(false);
  useFrame(() => {
    const r = refs.current;
    if (!armsPlaced.current && r.upperL && r.thumbR) {
      ([
        ["L", body.shL, body.elL, body.handL, 1],
        ["R", body.shR, body.elR, body.handR, -1],
      ] as const).forEach(([s, sh, el, hand, side]) => {
        const g = (n: string) => r[`${n}${s}`];
        // The inside of the elbow's bend, where the biceps lies.
        const inside = hand.clone().sub(el);
        const outside = inside.clone().negate();
        along(g("upper"), sh, el, -0.06, 1.0, 0.05, 0.048);
        along(g("bic"), sh, el, 0.2, 0.86, 0.04, 0.034, inside, 0.024);
        along(g("tri"), sh, el, 0.1, 0.78, 0.042, 0.036, outside, 0.022);
        joint(g("elbow"), el, 0.04);
        along(g("fore"), el, hand, -0.02, 0.96, 0.046, 0.04);
        // The forearm's bulk, high and on the thumb side.
        along(g("brach"), el, hand, 0.04, 0.5, 0.032, 0.03, outside, 0.02);
        joint(g("wrist"), hand.clone().lerp(el, 0.06), 0.026);
        // Palm, curled fingers and thumb, wrapped round the grip.
        along(g("palm"), el, hand, 0.96, 1.22, 0.042, 0.02, outside, 0.0);
        along(g("fingers"), el, hand, 1.12, 1.27, 0.038, 0.022, inside, 0.018);
        along(g("thumb"), el, hand, 1.0, 1.14, 0.014, 0.013, v3(0, 0, -side), 0.034);
      });
      armsPlaced.current = true;
    }
    // Walking: each foot swings forward, lifts on the swing, plants and is
    // carried back under the body; the other foot is half a cycle behind.
    const phase = walked ? (walked.current / 0.62) * Math.PI : 0;
    ([
      ["L", 0, body.hipL, 0.1],
      ["R", Math.PI, body.hipR, -0.1],
    ] as const).forEach(([s, off, hip, z], i) => {
      const g = (n: string) => r[`${n}${s}`];
      const p = phase + off;
      const swing = walked ? Math.sin(p) : s === "L" ? 0.35 : -0.6;
      const lift = walked ? Math.max(0, Math.cos(p)) * 0.07 : 0;
      // Feet sit behind the hips because the body leans into the push.
      const foot = feet ? feet[i] : v3(-0.2 + swing * 0.24, 0.07 + lift, z * 1.1);
      const front = v3(1, 0.2, 0);
      const knee = solve(hip, foot, THIGH, SHIN, front);
      const shinDir = foot.clone().sub(knee).normalize();
      // The front of the shin, square to the bone and towards the toes.
      const ahead = front.clone().sub(shinDir.clone().multiplyScalar(front.dot(shinDir))).normalize();
      const behind = ahead.clone().negate();
      const inward = v3(0, 0, -Math.sign(z));
      along(g("thigh"), hip, knee, -0.06, 1.0, 0.086, 0.08);
      along(g("shorts"), hip, knee, -0.08, 0.48, 0.1, 0.095);
      // The teardrop of muscle above the knee, on the inside.
      along(g("vastus"), hip, knee, 0.62, 0.96, 0.042, 0.036, ahead.clone().add(inward), 0.03);
      joint(g("knee"), knee.clone().addScaledVector(ahead, 0.008), 0.054);
      along(g("shin"), knee, foot, -0.02, 0.97, 0.056, 0.054);
      along(g("calf"), knee, foot, 0.06, 0.5, 0.05, 0.044, behind, 0.026);
      joint(g("ankle"), foot, 0.032);
      const f = g("foot");
      if (f) {
        f.position.set(foot.x + 0.07, foot.y - 0.035, foot.z);
        f.rotation.set(0, 0, 0);
        f.scale.set(0.11, 0.032, 0.045);
      }
      joint(g("heel"), v3(foot.x - 0.015, foot.y - 0.03, foot.z), 0.034);
    });
  });

  return (
    <group>
      {(["L", "R"] as const).flatMap((s) =>
        LIMB_FORMS.map(({ name, kind, geometry, outline }) => (
          <Moving key={name + s} name={name + s} kind={kind} register={register} geometry={geometry} outline={outline} />
        )),
      )}
      <group quaternion={tilt}>
        {torso().map(({ kind, geometry, contour }) => (
          <mesh key={kind} geometry={geometry} castShadow={kind !== "iron"}>
            <Look kind={kind} edges={false} />
            {contour && <BakedContour geometry={contour} />}
          </mesh>
        ))}
      </group>
    </group>
  );
}
