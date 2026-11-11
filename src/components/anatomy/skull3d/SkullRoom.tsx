"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { ExploreRoom, type RoomConfig } from "@/components/explore/ExploreRoom";
import { Part, SPOT, useExplode, type Drive, type PartDef, type Vec3 } from "@/components/explore/kit";
import { add, Bone, BONES_CREDIT, Drift, useBones, type Manifest, type MeshInfo } from "../bones3d";
import { LIVING_VIEWS, LivingDrawing } from "./LivingDrawing";
import data from "./manifest.json";

const manifest: Manifest = data;
const URL = "/anatomy/skull.bin";

/*
 * Folio II in three dimensions: the skull, taken apart.
 *
 * Leonardo could only saw a skull in half and draw what he saw. Here the same
 * head comes apart along its seams: twenty-two bones and twenty-eight teeth
 * drift out from the middle of the head, each tied back to it by a line of
 * ink, so the skull reads as a diagram with its centre where he looked for
 * the meeting point of the senses.
 *
 * The bones are a modern anatomical model, not his: see ../bones3d.
 */

const MESH = new Map(manifest.meshes.map((m) => [m.fma, m]));

/** The middle of the head, where the lines of the open view meet. */
const HUB: Vec3 = [0, -0.1, 0.2];
/** The jaw's hinge, just in front of the ear. */
const HINGE: Vec3 = [0, -0.33, 0.1];

// ── Which bone belongs to which part, and where it goes when the skull opens ──
type Group = {
  id: string;
  italian: string;
  english: string;
  text: string;
  /** Where the whole part travels. */
  out: Vec3;
  /** Paired bones also part sideways by this much. */
  apart?: number;
  bones: string[];
};

const teeth = (jaw: "upper" | "lower") => manifest.meshes.filter((m) => m.name.includes("tooth") && m.name.includes(jaw)).map((m) => m.fma);

const GROUPS: Group[] = [
  {
    id: "frontale",
    italian: "L’osso frontale",
    english: "The frontal bone",
    text: "The forehead and the roof of the eye sockets. In 1489 Leonardo drew the hollow inside it, above the eyes: the frontal sinus, in one of the earliest drawings of it known.",
    out: [0, 0.81, 0.85],
    bones: ["FMA52734"],
  },
  {
    id: "parietali",
    italian: "Le ossa parietali",
    english: "The parietal bones",
    text: "Two curved plates that make the roof and sides of the vault. They meet each other along the top of the head and the frontal bone across it, in seams that knit shut only in adult life.",
    out: [0, 1.23, -0.47],
    apart: 0.72,
    bones: ["FMA52788", "FMA52789"],
  },
  {
    id: "occipitale",
    italian: "L’osso occipitale",
    english: "The occipital bone",
    text: "The back and base of the skull. The great opening in it lets the spinal cord through, and the two smooth knuckles beside the opening are where the head nods on the spine.",
    out: [0, -0.21, -1.44],
    bones: ["FMA52735"],
  },
  {
    id: "temporali",
    italian: "Le ossa temporali",
    english: "The temporal bones",
    text: "The temples. Each one holds the ear, its hardest part housing the organs of hearing and balance, and carries the socket the jaw swings in.",
    out: [0, -0.04, -0.13],
    apart: 1.44,
    bones: ["FMA52738", "FMA52739"],
  },
  {
    id: "sfenoide",
    italian: "Lo sfenoide",
    english: "The sphenoid",
    text: "The keystone. Shaped like a bat with its wings spread, it sits in the middle of the head and touches almost every other bone of the skull, which is why it stays put while the others move away.",
    out: [0, 0, 0],
    bones: ["FMA52736"],
  },
  {
    id: "etmoide",
    italian: "L’etmoide e il vomere",
    english: "The inner nose",
    text: "Thin, light bones hidden behind the face: the ethmoid between the eyes, the vomer dividing the nose in two, and the small scrolls, tear-duct and palate bones around them. Leonardo’s sawn skull was a way to see in here.",
    out: [0, 0.17, 2],
    bones: ["FMA52740", "FMA9710", "FMA53645", "FMA53646", "FMA54737", "FMA54738", "FMA53655", "FMA53656"],
  },
  {
    id: "nasali",
    italian: "Le ossa nasali",
    english: "The nasal bones",
    text: "Two small plates forming the bridge of the nose. The rest of the nose is cartilage, which is why a skull has only an opening there.",
    out: [0, 0.85, 1.49],
    apart: 0.1,
    bones: ["FMA53647", "FMA53648"],
  },
  {
    id: "zigomi",
    italian: "Gli zigomi",
    english: "The cheekbones",
    text: "Each cheekbone bridges the upper jaw to the temple, making the outer rim of the eye socket and the arch you can feel in front of the ear.",
    out: [0, 0.04, 0.72],
    apart: 1.06,
    bones: ["FMA52892", "FMA52893"],
  },
  {
    id: "mascella",
    italian: "La mascella",
    english: "The upper jaw",
    text: "Two bones joined down the middle. They hold the upper teeth and form the floor of the eye sockets and the walls of the nose. Leonardo drew the hollow inside each one, the cheek sinus, some 160 years before it was named after Nathaniel Highmore.",
    out: [0, -0.3, 1.23],
    apart: 0.19,
    bones: ["FMA53649", "FMA53650"],
  },
  {
    id: "mandibola",
    italian: "La mandibola",
    english: "The lower jaw",
    text: "The only bone of the skull that moves. It hinges just in front of each ear; let it swing to see the hinge work.",
    out: [0, -0.95, 0.55],
    bones: ["FMA52748"],
  },
  {
    id: "denti",
    italian: "I denti",
    english: "The teeth",
    text: "Incisors to cut, canines to tear, premolars and molars to grind. Leonardo drew the four kinds side by side on one of his skull sheets. This model has 28: the four wisdom teeth are missing.",
    out: [0, 0, 0],
    bones: [...teeth("upper"), ...teeth("lower")],
  },
];

const UPPER = GROUPS.find((g) => g.id === "mascella")!.out;
const LOWER = GROUPS.find((g) => g.id === "mandibola")!.out;

/** How far one bone moves beyond its part's own travel. */
function inner(g: Group, m: MeshInfo): Vec3 {
  if (g.id === "denti") return m.name.includes("upper") ? add(UPPER, [0, -0.42, 0.45]) : add(LOWER, [0, 0.42, 0.45]);
  // The patient's right is the viewer's left: −x.
  const side = m.name.startsWith("right") ? -1 : m.name.startsWith("left") ? 1 : 0;
  return [side * (g.apart ?? 0), 0, 0];
}

/** Middle of a set of bones. */
function middle(ids: string[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const id of ids) {
    const m = MESH.get(id)!;
    for (let a = 0; a < 3; a++) c[a] += m.c[a] / ids.length;
  }
  return c;
}

// The part cards, camera framings and label pins all follow from the layout.
const PARTS: PartDef[] = GROUPS.map((g) => {
  // Label and camera go to one side of a pair (the viewer's right), or the upper teeth.
  const shown = g.id === "denti" ? teeth("upper") : g.apart ? g.bones.filter((b) => MESH.get(b)!.name.startsWith("left")) : g.bones;
  const at = middle(shown);
  const away = new THREE.Vector3(at[0] - HUB[0], (at[1] - HUB[1]) * 0.5 + 0.25, at[2] - HUB[2]);
  if (away.length() < 0.3) away.set(0.6, 0.3, 1);
  away.normalize().multiplyScalar(3.4);
  const shift = add(g.out, inner(g, MESH.get(shown[0])!));
  return {
    id: g.id,
    italian: g.italian,
    english: g.english,
    text: g.text,
    target: at,
    camera: [at[0] + away.x, at[1] + away.y, at[2] + away.z],
    explode: g.out,
    follow: shift,
    // Pinned a little way out from the bone, so the labels fan round the head.
    label: add(at, new THREE.Vector3(at[0] - HUB[0], at[1] - HUB[1], at[2] - HUB[2]).setLength(0.42).toArray() as Vec3),
  };
});

/** The lower jaw and its teeth swing on the hinge in front of the ear. */
function Jaw({ drive, children }: { drive: Drive; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const explode = useExplode();
  useFrame(() => {
    // It only works its hinge while the skull is whole.
    if (ref.current) ref.current.rotation.x = drive.current * 0.42 * (1 - Math.min(1, explode.current * 3));
  });
  return (
    <group ref={ref} position={HINGE}>
      <group position={[-HINGE[0], -HINGE[1], -HINGE[2]]}>{children}</group>
    </group>
  );
}

/** Ink threads from the middle of the head to every bone, drawn as the skull opens. */
function Threads() {
  const explode = useExplode();
  // One thread to each cluster of bones that travels together (a side of a
  // pair, a row of teeth), not one to every tooth.
  const ends = useMemo(
    () =>
      GROUPS.flatMap((g) => {
        const sets = new Map<string, string[]>();
        for (const b of g.bones) {
          const k = inner(g, MESH.get(b)!).join();
          sets.set(k, [...(sets.get(k) ?? []), b]);
        }
        return [...sets.values()].map((ids) => ({ from: middle(ids), by: add(g.out, inner(g, MESH.get(ids[0])!)) }));
      }),
    [],
  );
  const lines = useMemo(() => {
    const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(ends.length * 6), 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: SPOT, transparent: true, opacity: 0, depthWrite: false }));
    l.frustumCulled = false;
    l.raycast = () => null;
    return l;
  }, [ends]);
  const ref = useRef<THREE.LineSegments>(null);
  const hub = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const k = explode.current;
    const l = ref.current;
    if (l) {
      const pos = l.geometry.attributes.position as THREE.BufferAttribute;
      ends.forEach((e, i) => {
        pos.setXYZ(i * 2, HUB[0], HUB[1], HUB[2]);
        pos.setXYZ(i * 2 + 1, e.from[0] + e.by[0] * k, e.from[1] + e.by[1] * k, e.from[2] + e.by[2] * k);
      });
      pos.needsUpdate = true;
      (l.material as THREE.LineBasicMaterial).opacity = Math.min(0.55, k * 0.7);
      l.visible = k > 0.02;
    }
    if (hub.current) {
      hub.current.visible = k > 0.25;
      hub.current.scale.setScalar(Math.min(1, k * 1.4));
    }
  });
  return (
    <>
      <primitive ref={ref} object={lines} />
      <mesh ref={hub} position={HUB} raycast={() => null}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshBasicMaterial color={SPOT} />
      </mesh>
    </>
  );
}

function SkullModel({ drive }: { drive: Drive }) {
  const bones = useBones(URL, manifest);
  if (!bones) return null;
  return (
    <group>
      {GROUPS.map((g) => {
        const def = PARTS.find((p) => p.id === g.id)!;
        const pieces = g.bones.map((b, i) => {
          const m = MESH.get(b)!;
          // One label per part: on the viewer's right of a pair, else on its first bone.
          const labelled = g.apart ? m.name.startsWith("left") : i === 0;
          const piece = (
            <Drift key={b} by={inner(g, m)} labelFor={labelled ? { id: g.id, at: def.label } : undefined}>
              <Bone geo={bones.get(b)!} />
            </Drift>
          );
          return { piece, lower: g.id === "mandibola" || (g.id === "denti" && m.name.includes("lower")) };
        });
        return (
          <Part key={g.id} id={g.id} labelled={false}>
            {pieces.filter((p) => !p.lower).map((p) => p.piece)}
            {pieces.some((p) => p.lower) && <Jaw drive={drive}>{pieces.filter((p) => p.lower).map((p) => p.piece)}</Jaw>}
          </Part>
        );
      })}
      <Threads />
    </group>
  );
}

// ── Il disegno vivo: his page of 1489, coming alive (see ./LivingDrawing) ──────
function LivingScene({ view }: { view: string }) {
  return <LivingDrawing view={view} url={URL} manifest={manifest} />;
}

const CONFIG: RoomConfig = {
  folio: "II",
  title: "Il cranio",
  ariaLabel: "The skull in three dimensions",
  parts: PARTS,
  whole: "Tutto il cranio",
  overview: { target: [0, 0, 0.1], camera: [3.4, 1.3, 5.0], wide: [6.4, 2.4, 9.4] },
  Model: SkullModel,
  rest: 0,
  animate: (t) => 0.5 - 0.5 * Math.cos(t * 2.2),
  play: ["muovi la mandibola", "work the jaw"],
  // High enough that the jaw stays clear of the table when the skull opens.
  lift: 1.5,
  extent: 3.2,
  note: BONES_CREDIT,
  action: {
    label: "Il disegno vivo",
    Scene: LivingScene,
    views: LIVING_VIEWS,
    start: [0, 0, 9],
    far: 100,
    hint: "his own page of 1489 comes alive: the skull rises out of his ink, cut as he cut it, and is drawn again in his left-handed hatching as it turns",
  },
};

export default function SkullRoom({ onClose }: { onClose: () => void }) {
  return <ExploreRoom config={CONFIG} onClose={onClose} />;
}
