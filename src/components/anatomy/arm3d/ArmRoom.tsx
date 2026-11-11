"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "@/components/explore/ExploreRoom";
import { PAPER, Part, SPOT, type Drive, type PartDef, type Vec3 } from "@/components/explore/kit";
import { Bone, Drift, useBones, type Manifest, type MeshInfo } from "../bones3d";
import data from "./manifest.json";

/*
 * Folio V in three dimensions: the shoulder and arm, muscle by muscle.
 *
 * Leonardo drew the same shoulder over and over, turning it a step at a time
 * from the front round to the back, and drew a star of eight points to plan
 * the eight views. Here the shoulder turns the same way: play it and it steps
 * round his eight points. Open it and the muscles lift off the bone in their
 * layers, the way a dissection goes.
 *
 * Bones and muscles are a modern anatomical model, not his: BodyParts3D.
 */

const manifest: Manifest = data;
const URL = "/anatomy/arm.bin";
export const ARM_CREDIT = "A modern anatomical model, not Leonardo’s: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan.";

type Region = "ossa" | "deltoide" | "cuffia" | "petto" | "schiena" | "braccio" | "avambraccio" | "collo";
const has = (m: MeshInfo, ...w: string[]) => w.some((x) => m.name.includes(x));
function regionOf(m: MeshInfo): Region {
  if (has(m, "deltoid")) return "deltoide";
  if (has(m, "supraspinatus", "infraspinatus", "teres minor", "subscapularis")) return "cuffia";
  if (has(m, "pectoralis", "serratus")) return "petto";
  if (has(m, "trapezius", "latissimus", "rhomboid", "levator", "teres major")) return "schiena";
  if (has(m, "biceps", "triceps", "brachialis", "coracobrachialis") && !has(m, "brachioradialis")) return "braccio";
  if (has(m, "sternocleidomastoid")) return "collo";
  if (has(m, "pronator", "flexor", "extensor", "brachioradialis", "anconeus", "supinator", "palmaris")) return "avambraccio";
  return "ossa";
}
const COLOR: Record<Region, string> = {
  ossa: "#eadcbd",
  deltoide: "#cf8a70",
  cuffia: "#c97f68",
  petto: "#d39a80",
  schiena: "#c98d77",
  braccio: "#cf8a70",
  avambraccio: "#d6a189",
  collo: "#cc937c",
};

const ALL = manifest.meshes.map((m) => ({ m, region: regionOf(m) }));
const SHOULDER = manifest.meshes.find((m) => m.name === "left humerus")!;
/** The head of the humerus: the joint everything here turns about. */
const JOINT: Vec3 = [SHOULDER.c[0] - 0.05, SHOULDER.max[1] - 0.12, SHOULDER.c[2]];

type Group = { id: Region; italian: string; english: string; text: string };
const GROUPS: Group[] = [
  {
    id: "deltoide",
    italian: "Il deltoide",
    english: "The deltoid",
    text: "The cap of the shoulder, which lifts the arm out to the side. Anatomists describe it in three parts, front, middle and back, as this model has it. Leonardo divided it into separate pieces of his own, one of the quirks the Royal Collection notes on his sheet.",
  },
  {
    id: "cuffia",
    italian: "La cuffia dei rotatori",
    english: "The rotator cuff",
    text: "Four muscles from the shoulder blade that wrap the head of the humerus and hold it in its shallow socket while it turns: above, behind, and in front against the ribs.",
  },
  {
    id: "petto",
    italian: "Il petto",
    english: "The chest",
    text: "The great pectoral fans from the breastbone and collarbone to the arm, and draws it forward and across. Beneath it, the serratus holds the shoulder blade flat to the ribs.",
  },
  {
    id: "schiena",
    italian: "La schiena",
    english: "The back",
    text: "The trapezius and the muscles under it move the shoulder blade on the back; the broad latissimus pulls the arm down and back, as in climbing.",
  },
  {
    id: "braccio",
    italian: "Il braccio",
    english: "The upper arm",
    text: "The biceps in front bends the elbow and turns the palm up; the triceps behind, with three heads, straightens it. Each pulls against the other.",
  },
  {
    id: "avambraccio",
    italian: "L’avambraccio",
    english: "The forearm",
    text: "Muscles that bend and straighten the wrist and fingers, and turn the hand over. Leonardo studied how the forearm’s two bones cross over each other as the palm turns down.",
  },
  {
    id: "collo",
    italian: "Il collo",
    english: "The neck",
    text: "The long strap from behind the ear to the breastbone and collarbone, which turns and bows the head. On his sheet it rises above every view of the shoulder.",
  },
  {
    id: "ossa",
    italian: "Le ossa",
    english: "The bones",
    text: "Collarbone, shoulder blade, humerus, the radius and ulna, and the twenty-seven bones of the hand: the frame all these muscles pull on.",
  },
];

const middle = (r: Region): Vec3 => {
  const ms = ALL.filter((a) => a.region === r).map((a) => a.m);
  const c = ms.reduce<Vec3>((s, m) => [s[0] + m.c[0], s[1] + m.c[1], s[2] + m.c[2]], [0, 0, 0]);
  return [c[0] / ms.length, c[1] / ms.length, c[2] / ms.length];
};

/** Muscles lift off the bone along the line from the joint to their middle, the outer ones furthest. */
function drift(a: (typeof ALL)[number]): Vec3 {
  if (a.region === "ossa") return [0, 0, 0];
  const v = new THREE.Vector3(a.m.c[0] - JOINT[0], (a.m.c[1] - JOINT[1]) * 0.35, a.m.c[2] - JOINT[2]);
  if (v.length() < 0.05) v.set(0.3, 0, 0.3);
  const deep = a.region === "cuffia" ? 0.35 : a.region === "braccio" || a.region === "avambraccio" ? 0.55 : 0.8;
  return v.normalize().multiplyScalar(deep).toArray() as Vec3;
}

const PARTS: PartDef[] = GROUPS.map((g) => {
  const at = middle(g.id);
  return {
    id: g.id,
    italian: g.italian,
    english: g.english,
    text: g.text,
    target: at,
    camera: [at[0] + 2.4, at[1] + 0.5, at[2] + 3.4],
    label: [at[0] + 0.5, at[1] + 0.15, at[2] + 0.4],
  };
});

/** His eight views: a step of an eighth of a turn, a pause, the next step. */
const STEP = Math.PI / 4;
function stepAngle(u: number) {
  const k = Math.floor(u);
  const f = Math.min(1, (u - k) * 2.2);
  return (k + f * f * (3 - 2 * f)) * STEP;
}

function Turntable({ angle, children }: { angle: () => number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = angle();
  });
  return (
    <group ref={ref} position={JOINT}>
      <group position={[-JOINT[0], -JOINT[1], -JOINT[2]]}>{children}</group>
    </group>
  );
}

function ArmModel({ drive }: { drive: Drive }) {
  const bones = useBones(URL, manifest);
  if (!bones) return null;
  return (
    <Turntable angle={() => stepAngle(drive.current)}>
      {GROUPS.map((g) => {
        const def = PARTS.find((p) => p.id === g.id)!;
        const ms = ALL.filter((a) => a.region === g.id);
        return (
          <Part key={g.id} id={g.id} labelled={false}>
            {ms.map((a, i) => (
              <Drift key={a.m.fma} by={drift(a)} labelFor={i === 0 ? { id: g.id, at: def.label } : undefined}>
                <Bone geo={bones.get(a.m.fma)!} color={COLOR[g.id]} />
              </Drift>
            ))}
          </Part>
        );
      })}
    </Turntable>
  );
}

// ── Gli otto aspetti: his eight views, on his star ────────────────────────────
const VIEWS: ViewDef[] = [
  { id: "come", it: "Come lui", en: "Where he sat", offset: [0, 0.3, 8.5] },
  { id: "stella", it: "Sulla stella", en: "From above the star", offset: [0.01, 9, 3] },
  { id: "libera", it: "Libera", en: "Free", offset: [5, 2, 7] },
];

/** His star of eight points, ruled on the table under the shoulder. */
function Star({ step }: { step: React.RefObject<number> }) {
  const R = 2.4;
  const y = Math.min(...manifest.meshes.map((m) => m.min[1])) - 0.05;
  const lines = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    // Each point joined to the ones three steps away, as on his sheet.
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const b = ((i + 3) * Math.PI) / 4;
      pts.push(new THREE.Vector3(JOINT[0] + Math.sin(a) * R, y, JOINT[2] + Math.cos(a) * R), new THREE.Vector3(JOINT[0] + Math.sin(b) * R, y, JOINT[2] + Math.cos(b) * R));
    }
    const ring = Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(JOINT[0] + Math.sin(a) * R * 0.32, y, JOINT[2] + Math.cos(a) * R * 0.32);
    });
    const mat = new THREE.LineBasicMaterial({ color: SPOT, transparent: true, opacity: 0.8 });
    return [new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat), new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), mat)];
  }, [y]);
  const dot = useRef<THREE.Mesh>(null);
  useFrame(() => {
    // The point of the star you are looking from now: as the arm turns, the viewer's place on it moves the other way.
    const a = -(step.current ?? 0) * (Math.PI / 4);
    dot.current?.position.set(JOINT[0] + Math.sin(a) * R, y, JOINT[2] + Math.cos(a) * R);
  });
  return (
    <group raycast={() => null}>
      <primitive object={lines[0]} />
      <primitive object={lines[1]} />
      <mesh ref={dot}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshBasicMaterial color={SPOT} />
      </mesh>
    </group>
  );
}

function EightScene({ view }: { view: string }) {
  const bones = useBones(URL, manifest);
  const u = useRef(0);
  const step = useRef(0);
  useFrame((_, dt) => {
    u.current += dt / 1.8;
    step.current = Math.floor(u.current) % 8;
  });
  const subject = useRef<Subject>({ pos: new THREE.Vector3(JOINT[0], 0, JOINT[2]), yaw: 0, look: new THREE.Vector3(JOINT[0], -0.2, JOINT[2]) });
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <hemisphereLight args={["#fff4dc", "#d9c398", 1.3]} />
      <directionalLight position={[-4, 5, 6]} intensity={1.6} color="#fff1d6" />
      <directionalLight position={[3, -2, -3]} intensity={0.45} color="#f3e2c0" />
      {bones && (
        <Turntable angle={() => stepAngle(u.current)}>
          {ALL.map((a) => (
            <Bone key={a.m.fma} geo={bones.get(a.m.fma)!} color={COLOR[a.region]} />
          ))}
        </Turntable>
      )}
      <Star step={step} />
      <FollowCamera subject={subject} view={view} views={VIEWS} minDistance={3} maxDistance={20} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "V",
  title: "La spalla",
  ariaLabel: "The shoulder and arm in three dimensions",
  parts: PARTS,
  whole: "Tutta la spalla",
  overview: { target: [JOINT[0], -0.2, JOINT[2]], camera: [JOINT[0] + 2.6, 0.6, JOINT[2] + 7.4], wide: [JOINT[0] + 4, 1.2, JOINT[2] + 10] },
  Model: ArmModel,
  rest: 0,
  animate: (t) => t / 1.8,
  play: ["girala come lui", "turn it as he did"],
  lift: 2.5,
  extent: 4,
  note: ARM_CREDIT,
  action: {
    label: "Gli otto aspetti",
    Scene: EightScene,
    views: VIEWS,
    start: [0, 2, 12],
    far: 80,
    hint: "his plan of eight views, drawn as a star: the shoulder turns an eighth at a time, and the red point marks where you stand on his star",
  },
};

export default function ArmRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
