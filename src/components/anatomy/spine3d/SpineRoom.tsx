"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { ExploreRoom, FollowCamera, type RoomConfig, type Subject, type ViewDef } from "@/components/explore/ExploreRoom";
import { PAPER, Part, SPOT, useExplode, type Drive, type PartDef, type Vec3 } from "@/components/explore/kit";
import { Bone, BONES_CREDIT, Drift, useBones, type Manifest, type MeshInfo } from "../bones3d";
import data from "./manifest.json";

/*
 * Folio III in three dimensions: the spine, drawn out.
 *
 * Leonardo's sheet of 1510–11 is the first to get the column right: seven
 * vertebrae in the neck, twelve in the back, five in the loins, the fused
 * sacrum, and the four bends between them. Here the same column hangs in the
 * air, and opening it draws it out like a concertina: every vertebra parts
 * from the next, and the discs that sat between them slide out in front.
 *
 * The bones are a modern anatomical model, not his: see ../bones3d. It has
 * no separate tailbone.
 */

const manifest: Manifest = data;
const URL = "/anatomy/spine.bin";
const DISC = "#dcc09a";

const isDisc = (m: MeshInfo) => m.name.startsWith("intervertebral");
const VERTEBRAE = manifest.meshes.filter((m) => !isDisc(m)); // top to bottom: C1 … L5, sacrum
const DISCS = manifest.meshes.filter(isDisc);

/** How far the column is drawn out, and how far the discs slide forward. */
const STRETCH = 0.5;
const DISC_OUT = 0.95;
/** Where a bone goes when the column opens: further from the middle, the further it travels. */
const drift = (m: MeshInfo): Vec3 => [0, m.c[1] * STRETCH, isDisc(m) ? DISC_OUT : 0];

type Group = { id: string; italian: string; english: string; text: string; bones: MeshInfo[] };
const GROUPS: Group[] = [
  {
    id: "atlante",
    italian: "L’atlante",
    english: "The atlas",
    text: "The first vertebra, a plain ring with no body of its own. The skull rests on its two shallow cups and rocks there when you nod. Let it turn to see the joint below it work.",
    bones: VERTEBRAE.slice(0, 1),
  },
  {
    id: "epistrofeo",
    italian: "L’epistrofeo",
    english: "The axis",
    text: "The second vertebra. A peg of bone stands up from it into the ring of the atlas, and the atlas, carrying the head, pivots round that peg when you shake your head.",
    bones: VERTEBRAE.slice(1, 2),
  },
  {
    id: "cervicali",
    italian: "Le cervicali",
    english: "The neck, five more",
    text: "With the atlas and axis these make the seven vertebrae of the neck that Leonardo counted. They are the smallest and the freest, and together they bend forward: the first of the four curves.",
    bones: VERTEBRAE.slice(2, 7),
  },
  {
    id: "toraciche",
    italian: "Le toraciche",
    english: "The back, twelve",
    text: "Each carries a pair of ribs, and their long spines slope down over one another like roof tiles. They curve backward. This is where Leonardo made his one slip: twelve vertebrae, but thirteen spines.",
    bones: VERTEBRAE.slice(7, 19),
  },
  {
    id: "lombari",
    italian: "Le lombari",
    english: "The loins, five",
    text: "The largest vertebrae, because they carry the most weight. Their curve bends forward again, bringing the body back over the legs.",
    bones: VERTEBRAE.slice(19, 24),
  },
  {
    id: "sacro",
    italian: "Il sacro",
    english: "The sacrum",
    text: "Five vertebrae fused into one wedge, locked between the hip bones. It curves backward, the last of the four bends. The tailbone below it is missing from this model.",
    bones: VERTEBRAE.slice(24),
  },
  {
    id: "dischi",
    italian: "I dischi",
    english: "The discs",
    text: "Pads of cartilage between the vertebral bodies, twenty-three of them here. They take up shock and let each joint give a little, which adds up to the bend of the whole column.",
    bones: DISCS,
  },
];

const PARTS: PartDef[] = GROUPS.map((g) => {
  // The label and the camera go to the bone in the middle of the group.
  const mid = g.bones[Math.floor(g.bones.length / 2)];
  const at = mid.c as Vec3;
  const span = g.bones[0].max[1] - g.bones[g.bones.length - 1].min[1];
  const back = Math.max(2.2, span * 1.6 + 1.2);
  return {
    id: g.id,
    italian: g.italian,
    english: g.english,
    text: g.text,
    target: at,
    camera: [at[0] + back * 0.75, at[1] + 0.3, at[2] + back * 0.7],
    follow: drift(mid),
    // Out to the side of the column, so the names read down it like his letters.
    label: [at[0] + 0.62, at[1], at[2] + (g.id === "dischi" ? 0.35 : 0)],
  };
});

/** The atlas turns on the peg of the axis, as the head does. */
function Pivot({ drive, children }: { drive: Drive; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const explode = useExplode();
  const atlas = VERTEBRAE[0];
  // The peg stands in the front third of the ring.
  const peg: Vec3 = [atlas.c[0], 0, atlas.max[2] - (atlas.max[2] - atlas.min[2]) * 0.3];
  useFrame(() => {
    // Only while the column is whole: opened, the atlas has nothing to turn on.
    if (ref.current) ref.current.rotation.y = (drive.current - 0.5) * 1.3 * (1 - Math.min(1, explode.current * 3));
  });
  return (
    <group ref={ref} position={peg}>
      <group position={[-peg[0], 0, -peg[2]]}>{children}</group>
    </group>
  );
}

/** A red thread down the middle of the opened column, bead to bead. */
function Thread() {
  const explode = useExplode();
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(VERTEBRAE.length * 3), 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: SPOT, transparent: true, opacity: 0, depthWrite: false }));
    l.frustumCulled = false;
    l.raycast = () => null;
    return l;
  }, []);
  const ref = useRef<THREE.Line>(null);
  useFrame(() => {
    const l = ref.current;
    if (!l) return;
    const k = explode.current;
    const pos = l.geometry.attributes.position as THREE.BufferAttribute;
    VERTEBRAE.forEach((m, i) => pos.setXYZ(i, m.c[0], m.c[1] * (1 + STRETCH * k), m.c[2]));
    pos.needsUpdate = true;
    (l.material as THREE.LineBasicMaterial).opacity = Math.min(0.6, k * 0.8);
    l.visible = k > 0.02;
  });
  return <primitive ref={ref} object={line} />;
}

function SpineModel({ drive }: { drive: Drive }) {
  const bones = useBones(URL, manifest);
  if (!bones) return null;
  return (
    <group>
      {GROUPS.map((g) => {
        const def = PARTS.find((p) => p.id === g.id)!;
        const mid = g.bones[Math.floor(g.bones.length / 2)];
        const pieces = g.bones.map((m) => (
          <Drift key={m.fma} by={drift(m)} labelFor={m === mid ? { id: g.id, at: def.label } : undefined}>
            <Bone geo={bones.get(m.fma)!} color={isDisc(m) ? DISC : undefined} />
          </Drift>
        ));
        return (
          <Part key={g.id} id={g.id} labelled={false}>
            {g.id === "atlante" ? <Pivot drive={drive}>{pieces}</Pivot> : pieces}
          </Part>
        );
      })}
      <Thread />
    </group>
  );
}

// ── Le quattro curve: the bends he was first to draw ──────────────────────────
const VIEWS: ViewDef[] = [
  { id: "fianco", it: "Di fianco", en: "From the side", offset: [11.5, 0, 0.4] },
  { id: "fronte", it: "Di fronte", en: "From the front", offset: [0.4, 0, 11.5] },
  { id: "dietro", it: "Di dietro", en: "From behind", offset: [-0.4, 0, -11.5] },
  { id: "libera", it: "Libera", en: "Free", offset: [8, 1.5, 8] },
];

function CurvesScene({ view }: { view: string }) {
  const bones = useBones(URL, manifest);
  // The line of the column runs through the discs, which sit between the bodies.
  const curve = useMemo(() => {
    const top = VERTEBRAE[0];
    const base = VERTEBRAE[VERTEBRAE.length - 1];
    const pts = [
      new THREE.Vector3(0, top.max[1], DISCS[0].c[2] - 0.04),
      ...DISCS.map((d) => new THREE.Vector3(0, d.c[1], d.c[2])),
      new THREE.Vector3(0, base.c[1], base.c[2] + 0.12),
      new THREE.Vector3(0, base.min[1], base.c[2] - 0.2),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.022, 8);
  }, []);
  const subject = useRef<Subject>({ pos: new THREE.Vector3(0, 0, 0), yaw: 0, look: new THREE.Vector3(0, 0, 0) });
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <hemisphereLight args={["#fff4dc", "#d9c398", 1.3]} />
      <directionalLight position={[6, 5, 4]} intensity={1.5} color="#fff1d6" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#f3e2c0" />
      {bones && manifest.meshes.map((m) => <Bone key={m.fma} geo={bones.get(m.fma)!} color={isDisc(m) ? DISC : undefined} />)}
      {/* Drawn over the bones, like a red pen over the print. */}
      <mesh geometry={curve} renderOrder={10} raycast={() => null}>
        <meshBasicMaterial color={SPOT} depthTest={false} transparent opacity={0.85} />
      </mesh>
      <FollowCamera subject={subject} view={view} views={VIEWS} minDistance={3} maxDistance={24} />
    </>
  );
}

const CONFIG: RoomConfig = {
  folio: "III",
  title: "La spina",
  ariaLabel: "The spine in three dimensions",
  parts: PARTS,
  whole: "Tutta la spina",
  overview: { target: [0, 0, 0], camera: [6.6, 0.8, 9.6], wide: [8.6, 1.0, 12.4] },
  Model: SpineModel,
  rest: 0.5,
  animate: (t) => 0.5 + 0.5 * Math.sin(t * 1.3),
  play: ["gira l’atlante", "turn the head"],
  // High enough that the sacrum stays clear of the table when the column is drawn out.
  lift: 3.9,
  extent: 7,
  note: BONES_CREDIT,
  action: {
    label: "Le quattro curve",
    Scene: CurvesScene,
    views: VIEWS,
    start: [16, 2, 6],
    far: 120,
    hint: "the four bends he was first to draw: the neck forward, the back backward, the loins forward, the sacrum backward",
  },
};

export default function SpineRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
