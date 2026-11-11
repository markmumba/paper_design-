"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "@/components/explore/ExploreRoom";
import { PAPER, Part, SPOT, type Drive, type PartDef, type Vec3 } from "@/components/explore/kit";
import { Bone, BONES_CREDIT, Drift, useBones, type Bones, type Manifest, type MeshInfo } from "../bones3d";
import data from "./manifest.json";

/*
 * Folio I in three dimensions: the Vitruvian Man, down to the bone.
 *
 * A whole skeleton stands inside Leonardo's square and circle. Play it and it
 * moves between his two poses: arms level and feet together, which fits the
 * square; arms raised and legs apart, which fits the circle. Open it and the
 * bones drift apart by region.
 *
 * The bones are a modern anatomical model, not his: see ../bones3d. Its arms
 * hang at its sides; we turn them, and the legs, about the shoulder and hip.
 */

const manifest: Manifest = data;
const URL = "/anatomy/body.bin";

const has = (m: MeshInfo, ...w: string[]) => w.some((x) => m.name.includes(x));
const side = (m: MeshInfo) => (m.name.includes("left") ? 1 : m.name.includes("right") ? -1 : 0);

type Region = "cranio" | "spina" | "torace" | "braccia" | "bacino" | "gambe";
function regionOf(m: MeshInfo): Region {
  if (has(m, "vertebra", "intervertebral", "sacrum") || m.name === "atlas" || m.name === "axis") return "spina";
  if (has(m, "humerus", "radius", "ulna", "scaphoid", "lunate", "triquetral", "pisiform", "trapezium", "trapezoid", "capitate", "hamate", "metacarpal", "finger", "thumb"))
    return "braccia";
  if (has(m, "femur", "patella", "tibia", "fibula", "talus", "calcaneus", "navicular", "cuneiform", "cuboid", "metatarsal", "toe")) return "gambe";
  if (has(m, "hip bone")) return "bacino";
  if (has(m, "rib", "costal", "sternum", "manubrium", "xiphoid", "clavicle", "scapula")) return "torace";
  return "cranio";
}

const ALL = manifest.meshes.map((m) => ({ m, region: regionOf(m), side: side(m) }));
const find = (name: string) => manifest.meshes.find((m) => m.name === name)!;

// ── The frame: heel to crown, and Leonardo's two centres ─────────────────────
const CROWN = Math.max(...manifest.meshes.map((m) => m.max[1]));
const SOLE = Math.min(...manifest.meshes.map((m) => m.min[1]));
const H = CROWN - SOLE;
const GROIN: Vec3 = [0, (CROWN + SOLE) / 2, 0]; // the square's centre: half the height
const NAVEL: Vec3 = [0, CROWN - 0.394 * H, 0]; // the circle's centre, where he put it
const RADIUS = 0.618 * H; // as measured on his sheet

// Joints the limbs turn about: the top of the humerus, the head of the femur.
const SHOULDER = (s: 1 | -1): Vec3 => {
  const h = find(s > 0 ? "left humerus" : "right humerus");
  return [s * (Math.abs(h.c[0]) - 0.07), h.max[1] - 0.1, h.c[2]];
};
const HIP = (s: 1 | -1): Vec3 => {
  const f = find(s > 0 ? "left femur" : "right femur");
  return [s * (Math.min(Math.abs(f.min[0]), Math.abs(f.max[0])) + 0.08), f.max[1] - 0.08, f.c[2] + 0.12];
};

/** The two poses, as angles from hanging straight down: drive 0 is the square, 1 the circle. */
const armAngle = (d: number) => Math.PI / 2 + 0.42 * d;
const legAngle = (d: number) => 0.5 * d;

// ── Parts ─────────────────────────────────────────────────────────────────────
type Group = { id: Region; italian: string; english: string; text: string; out: Vec3 };
const GROUPS: Group[] = [
  {
    id: "cranio",
    italian: "Il cranio",
    english: "The skull",
    text: "Twenty-two bones and the teeth, locked together at seams. It crowns the square: Vitruvius made the head, chin to crown, an eighth of the whole height.",
    out: [0, 1.2, 0.2],
  },
  {
    id: "spina",
    italian: "La spina",
    english: "The spine",
    text: "Seven vertebrae of the neck, twelve of the back, five of the loins and the sacrum: the column Leonardo was the first to draw rightly. The tailbone is missing from this model.",
    out: [0, 0, -1.1],
  },
  {
    id: "torace",
    italian: "Il torace",
    english: "The chest and shoulders",
    text: "Twelve pairs of ribs; the first seven reach the breastbone by their own cartilage. The collarbones and shoulder blades hang the arms from the trunk.",
    out: [0, 0.6, 1.1],
  },
  {
    id: "braccia",
    italian: "Le braccia",
    english: "The arms",
    text: "Thirty bones in each arm and hand. Stretched out level, fingertip to fingertip, they span about a man’s height: the side of Vitruvius’ square.",
    out: [0, 0.3, 0.4],
  },
  {
    id: "bacino",
    italian: "Il bacino",
    english: "The pelvis",
    text: "Two hip bones, each grown together in youth from three, closed behind by the sacrum. Leonardo set the centre of the square here, at the groin, half way up the body.",
    out: [0, -0.5, 0.9],
  },
  {
    id: "gambe",
    italian: "Le gambe",
    english: "The legs",
    text: "Thirty bones in each leg and foot, among them the femur, the longest bone in the body. Spread apart, the feet reach the circle drawn round the navel.",
    out: [0, -1.1, 0.3],
  },
];

const CENTRE: Record<Region, Vec3> = Object.fromEntries(
  GROUPS.map((g) => {
    const ms = ALL.filter((a) => a.region === g.id).map((a) => a.m);
    const c = ms.reduce<Vec3>((s, m) => [s[0] + m.c[0], s[1] + m.c[1], s[2] + m.c[2]], [0, 0, 0]);
    return [g.id, [c[0] / ms.length, c[1] / ms.length, c[2] / ms.length]];
  }),
) as Record<Region, Vec3>;

const PARTS: PartDef[] = GROUPS.map((g) => {
  const c = CENTRE[g.id];
  // Arms and legs are labelled on the figure's left side, where they are posed.
  const at: Vec3 = g.id === "braccia" ? [2.2, SHOULDER(1)[1], 0] : g.id === "gambe" ? [0.9, -1.6, 0] : c;
  const back = g.id === "braccia" || g.id === "gambe" ? 6.5 : 4.2;
  return {
    id: g.id,
    italian: g.italian,
    english: g.english,
    text: g.text,
    target: at,
    camera: [at[0] + back * 0.55, at[1] + 0.6, at[2] + back],
    follow: g.out,
    label: [at[0] + (g.id === "braccia" ? 0.4 : 0.9), at[1] + 0.2, at[2] + 0.3],
  };
});

/** Where each bone drifts when the figure opens: its region's way, and a little apart within it. */
function drift(a: (typeof ALL)[number]): Vec3 {
  const g = GROUPS.find((x) => x.id === a.region)!;
  const c = CENTRE[a.region];
  const k = 0.18;
  return [g.out[0] + (a.m.c[0] - c[0]) * k, g.out[1] + (a.m.c[1] - c[1]) * k, g.out[2] + (a.m.c[2] - c[2]) * k];
}

/** A limb that turns about a joint, by an angle read from `angle` every frame. */
function Limb({ pivot, angle, children }: { pivot: Vec3; angle: () => number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = angle();
  });
  return (
    <group ref={ref} position={pivot}>
      <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{children}</group>
    </group>
  );
}

/** The skeleton, posed by `drive`, its bones wrapped by `wrap` (for drifting and labels). */
function Skeleton({ bones, drive, wrap }: { bones: Bones; drive: Drive; wrap?: (a: (typeof ALL)[number], el: ReactNode) => ReactNode }) {
  const piece = (a: (typeof ALL)[number]) => {
    const el = <Bone key={a.m.fma} geo={bones.get(a.m.fma)!} />;
    return wrap ? wrap(a, el) : el;
  };
  const body = ALL.filter((a) => !(a.region === "braccia" || a.region === "gambe"));
  const limb = (region: Region, s: 1 | -1) => ALL.filter((a) => a.region === region && a.side === s);
  return (
    <>
      {body.map(piece)}
      {([1, -1] as const).map((s) => (
        <Limb key={`a${s}`} pivot={SHOULDER(s)} angle={() => s * armAngle(drive.current)}>
          {limb("braccia", s).map(piece)}
        </Limb>
      ))}
      {([1, -1] as const).map((s) => (
        <Limb key={`l${s}`} pivot={HIP(s)} angle={() => s * legAngle(drive.current)}>
          {limb("gambe", s).map(piece)}
        </Limb>
      ))}
    </>
  );
}

/** Leonardo's square and circle, ruled in the spot colour round the figure. */
function Frame({ opacity = 0.75 }: { opacity?: number }) {
  const geo = useMemo(() => {
    const s = H / 2;
    const sq = new THREE.BufferGeometry().setFromPoints(
      [
        [-s, s],
        [s, s],
        [s, -s],
        [-s, -s],
        [-s, s],
      ].map(([x, y]) => new THREE.Vector3(x, GROIN[1] + y, -0.05)),
    );
    const ring = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, i) => {
        const a = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * RADIUS, NAVEL[1] + Math.sin(a) * RADIUS, -0.05);
      }),
    );
    return { sq, ring };
  }, []);
  const lines = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: SPOT, transparent: true, opacity });
    return [new THREE.Line(geo.sq, mat), new THREE.Line(geo.ring, mat)];
  }, [geo, opacity]);
  return (
    <group raycast={() => null}>
      <primitive object={lines[0]} />
      <primitive object={lines[1]} />
      <mesh position={NAVEL}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color={SPOT} />
      </mesh>
      <mesh position={GROIN}>
        <sphereGeometry args={[0.05, 12, 8]} />
        <meshBasicMaterial color={SPOT} />
      </mesh>
    </group>
  );
}

function BodyModel({ drive }: { drive: Drive }) {
  const bones = useBones(URL, manifest);
  if (!bones) return null;
  return (
    <group>
      {GROUPS.map((g) => {
        const def = PARTS.find((p) => p.id === g.id)!;
        return (
          <Part key={g.id} id={g.id} labelled={false}>
            <Skeleton
              bones={bones}
              drive={drive}
              wrap={(a, el) =>
                a.region === g.id ? (
                  <Drift key={a.m.fma} by={drift(a)}>
                    {el}
                  </Drift>
                ) : null
              }
            />
            {/* The label rides with the region, outside the turning limbs. */}
            <Drift by={g.out} labelFor={{ id: g.id, at: def.label }}>
              {null}
            </Drift>
          </Part>
        );
      })}
      <Frame />
    </group>
  );
}

// ── Il cerchio e il quadrato: the two poses, slowly, in his frame ────────────
const VIEWS: ViewDef[] = [
  { id: "fronte", it: "Di fronte", en: "As he drew it", offset: [0, 0, 15] },
  { id: "fianco", it: "Di fianco", en: "From the side", offset: [15, 0, 0.5] },
  { id: "libera", it: "Libera", en: "Free", offset: [9, 3, 11] },
];

function FrameScene({ view }: { view: string }) {
  const bones = useBones(URL, manifest);
  const drive = useRef(0);
  useFrame(({ clock }) => {
    // Hold each pose a moment, then move to the other.
    const t = (clock.elapsedTime % 8) / 8;
    const k = t < 0.3 ? 0 : t < 0.5 ? (t - 0.3) / 0.2 : t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
    drive.current = k * k * (3 - 2 * k);
  });
  const subject = useRef<Subject>({ pos: new THREE.Vector3(0, NAVEL[1] - 0.6, 0), yaw: 0, look: new THREE.Vector3(0, NAVEL[1] - 0.6, 0) });
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <hemisphereLight args={["#fff4dc", "#d9c398", 1.3]} />
      <directionalLight position={[5, 6, 8]} intensity={1.5} color="#fff1d6" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#f3e2c0" />
      {bones && <Skeleton bones={bones} drive={drive} />}
      <Frame opacity={0.9} />
      <FollowCamera subject={subject} view={view} views={VIEWS} minDistance={5} maxDistance={30} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "I",
  title: "L’uomo vitruviano",
  ariaLabel: "The Vitruvian Man in three dimensions",
  parts: PARTS,
  whole: "Tutto l’uomo",
  overview: { target: [0, 0, 0], camera: [5.5, 1.4, 13], wide: [8, 2, 18] },
  Model: BodyModel,
  rest: 0,
  animate: (t) => 0.5 - 0.5 * Math.cos(t * 0.9),
  play: ["le due pose", "the two poses"],
  // High enough that the feet stay clear of the table when the figure opens.
  lift: 4.6,
  extent: 7,
  note: BONES_CREDIT,
  action: {
    label: "Il cerchio e il quadrato",
    Scene: FrameScene,
    views: VIEWS,
    start: [0, 1, 18],
    far: 120,
    hint: "his two poses in his two figures: level arms fill the square, raised arms and parted legs touch the circle",
  },
};

export default function BodyRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
