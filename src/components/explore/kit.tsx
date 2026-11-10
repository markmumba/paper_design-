"use client";

import { Edges } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";

/*
 * The kit every 3D room is built from: the printed-ink look, clickable parts
 * that can fly apart in an exploded view, and labels pinned to parts.
 */

export const INK = "#3a2717";
export const SPOT = "#e4572e";
export const PAPER = "#e9dab9";

export type Vec3 = [number, number, number];

/** One selectable part of a machine, with its note and how the camera frames it. */
export type PartDef = {
  id: string;
  italian: string;
  english: string;
  text: string;
  target: Vec3;
  camera: Vec3;
  /** How far the part travels in the exploded view (in its own frame). */
  explode?: Vec3;
  /** World-space shift of the part when exploded, if different (e.g. mirrored wings). */
  follow?: Vec3;
  /** Where its label is pinned (in its own frame). */
  label: Vec3;
};

export type Drive = { current: number };

// ── Contexts ──────────────────────────────────────────────────────────────────
type Frame = {
  parts: Map<string, PartDef>;
  hovered: string | null;
  selected: string | null;
  explode: Drive;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
};
const NO_EXPLODE: Drive = { current: 0 };
const FrameContext = createContext<Frame>({ parts: new Map(), hovered: null, selected: null, explode: NO_EXPLODE });
const PartContext = createContext<string | null>(null);

/** Wraps a machine model to make its parts interactive (used by the Anatomia view). */
export function MachineFrame({
  parts,
  hovered,
  selected,
  explode,
  onHover,
  onSelect,
  children,
}: {
  parts: PartDef[];
  hovered: string | null;
  selected: string | null;
  explode: Drive;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const map = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const value = useMemo(() => ({ parts: map, hovered, selected, explode, onHover, onSelect }), [map, hovered, selected, explode, onHover, onSelect]);
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>;
}

export function useLook() {
  const part = useContext(PartContext);
  const { hovered, selected } = useContext(FrameContext);
  const lit = part !== null && (hovered === part || selected === part);
  const dimmed = selected !== null && selected !== part;
  return { lit, dimmed };
}

export function useExplode() {
  return useContext(FrameContext).explode;
}

// ── The printed look ──────────────────────────────────────────────────────────
/*
 * Riso-print shading. The lit result is not shown directly: it is converted to
 * a 45° screen of ink dots over the flat paper-toned colour, dots growing where
 * the light falls away, so the model looks printed rather than rendered.
 */
const HALFTONE_KEY = () => "codex-halftone";
export function halftone(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <opaque_fragment>",
    /* glsl */ `
    float albedoLum = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.02);
    float lightLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114)) / albedoLum;
    float shade = clamp(1.08 - lightLum, 0.0, 1.0);
    vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 5.0;
    float d = length(fract(q) - 0.5);
    float r = sqrt(shade) * 0.64;
    float aa = fwidth(d) * 0.9;
    float inkDot = 1.0 - smoothstep(r - aa, r + aa, d);
    vec3 printed = mix(diffuseColor.rgb * 1.03, vec3(0.227, 0.153, 0.09), inkDot * 0.8);
    gl_FragColor = vec4(printed, diffuseColor.a);
    `,
  );
}

export type Kind =
  | "wood" | "darkwood" | "cane" | "cloth" | "spot" | "metal" | "iron" | "skin" | "stone" | "rope"
  | "flesh" | "hair" | "linen" | "cord";
const BASE: Record<Kind, string> = {
  wood: "#dcbf92",
  darkwood: "#b48a58",
  cane: "#b98f60",
  cloth: "#f2e6c9",
  spot: SPOT,
  metal: "#9a8164",
  iron: "#7d6a55",
  skin: "#ead2ae",
  stone: "#cbb894",
  rope: "#a9875c",
  // A sun-browned working man, and his cropped hair.
  flesh: "#d9a47c",
  hair: "#6a4a2e",
  // What the men wear: linen shorts and the cord that ties them.
  linen: "#eee3ca",
  cord: "#a07e55",
};

/** A material plus ink outline that respond to hover / selection. */
export function Look({ kind, edges = true }: { kind: Kind; edges?: boolean }) {
  const { lit, dimmed } = useLook();
  // People keep their own colours when picked: the rest of the machine dims,
  // and painting a whole figure one flat colour would erase its form.
  const anatomy = kind === "flesh" || kind === "hair" || kind === "linen" || kind === "cord";
  const color = lit && !anatomy ? (kind === "cloth" ? "#f6c3a8" : SPOT) : BASE[kind];
  const thin = kind === "cloth" || kind === "spot";
  const opacity = dimmed ? 0.14 : kind === "cloth" ? 0.9 : 1;
  return (
    <>
      <meshStandardMaterial
        onBeforeCompile={halftone}
        customProgramCacheKey={HALFTONE_KEY}
        color={color}
        roughness={0.92}
        metalness={0}
        transparent={opacity < 1}
        opacity={opacity}
        side={thin ? THREE.DoubleSide : THREE.FrontSide}
        depthWrite={!dimmed}
      />
      {edges && (
        <Edges
          threshold={thin ? 12 : 40}
          color={lit ? SPOT : INK}
          lineWidth={lit ? 2.2 : kind === "cane" || kind === "metal" || kind === "rope" ? 1.1 : 1.5}
          transparent
          opacity={dimmed ? 0.12 : 0.9}
        />
      )}
    </>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────
/**
 * Label anchors: an empty object per part, pinned where its label should sit.
 * The room projects these to the screen each frame (see LabelProjector), so
 * labels are plain HTML in one layer rather than one React root per label.
 */
export const labelAnchors = new Map<string, THREE.Object3D>();

function PartLabel({ id, at }: { id: string; at: Vec3 }) {
  return (
    <group
      position={at}
      ref={(o) => {
        if (o) labelAnchors.set(id, o);
        else labelAnchors.delete(id);
      }}
    />
  );
}

const projected = new THREE.Vector3();
function placeLabel(el: HTMLElement, anchor: THREE.Object3D, camera: THREE.Camera, w: number, h: number) {
  anchor.getWorldPosition(projected).project(camera);
  const x = (projected.x * 0.5 + 0.5) * w;
  const y = (-projected.y * 0.5 + 0.5) * h;
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
  el.style.visibility = projected.z > 1 ? "hidden" : "";
}

/** Moves each HTML label to its anchor's on-screen position every frame. */
export function LabelProjector({ elements }: { elements: RefObject<Map<string, HTMLElement>> }) {
  useFrame((state) => {
    for (const [id, el] of elements.current) {
      const anchor = labelAnchors.get(id);
      if (anchor) placeLabel(el, anchor, state.camera, state.size.width, state.size.height);
    }
  });
  return null;
}

// ── Parts ─────────────────────────────────────────────────────────────────────
/** Groups meshes into one clickable, hoverable part that can fly apart. */
export function Part({ id, children, labelled = true }: { id: string; children: ReactNode; labelled?: boolean }) {
  const frame = useContext(FrameContext);
  const def = frame.parts.get(id);
  const ref = useRef<THREE.Group>(null);
  const off = def?.explode;
  const explode = frame.explode;
  useFrame(() => {
    if (ref.current && off) ref.current.position.set(off[0] * explode.current, off[1] * explode.current, off[2] * explode.current);
  });
  const { onHover, onSelect } = frame;
  return (
    <PartContext.Provider value={id}>
      <group
        ref={ref}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (!onHover) return;
          e.stopPropagation();
          onHover(id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (!onHover) return;
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!onSelect) return;
          e.stopPropagation();
          onSelect(id);
        }}
      >
        {children}
        {labelled && def && <PartLabel id={id} at={def.label} />}
      </group>
    </PartContext.Provider>
  );
}

// ── Small geometry helpers ──────────────────────────────────────────────────────
/** A cylinder stretched between two points (beams, axles, ropes). */
export function Beam({ from, to, r, kind = "wood", sides = 8 }: { from: Vec3; to: Vec3; r: number; kind?: Kind; sides?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      pos: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      len: dir.length(),
    };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, sides]} />
      <Look kind={kind} />
    </mesh>
  );
}

/** A spur gear as an extruded tooth profile, facing +Z. */
export function gearGeometry(r: number, teeth: number, depth: number, thickness: number, hole = 0.18) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [a, r - depth],
      [a + step * 0.18, r],
      [a + step * 0.48, r],
      [a + step * 0.66, r - depth],
    ];
    pts.forEach(([ang, rad], k) => {
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, r * hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -thickness / 2);
  return g;
}
