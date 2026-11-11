"use client";

import { useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRef } from "react";
import * as THREE from "three";
import { halftone, INK, labelAnchors, SPOT, useExplode, useLook, type Vec3 } from "@/components/explore/kit";

/*
 * What the anatomy rooms share: real bones, loaded from one small file, printed
 * in the same ink as the machines, and able to drift apart when a room opens.
 *
 * The bones are not Leonardo's. They are a modern anatomical model,
 * BodyParts3D (© The Database Center for Life Science, CC Attribution-Share
 * Alike 2.1 Japan), reduced to about a seventh of its triangles. Every room
 * that uses them says so, and so do the sources.
 */

export const BONES_CREDIT = "A modern anatomical model, not Leonardo’s: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan.";
export const BONE = "#eadcbd";

/** One bone in a packed file: where its vertices and triangles sit, and its middle. */
export type MeshInfo = { fma: string; name: string; v: number[]; i: number[]; min: number[]; max: number[]; c: number[] };
export type Manifest = { scale: number; vertices: number; indices: number; meshes: MeshInfo[] };
export type Bones = Map<string, THREE.BufferGeometry>;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ── Loading ───────────────────────────────────────────────────────────────────
const loads = new Map<string, Promise<Bones>>();

/** Fetch a packed bone file: 16-bit positions for every bone, then 16-bit triangle indices. */
function loadBones(url: string, manifest: Manifest): Promise<Bones> {
  let load = loads.get(url);
  if (!load) {
    load = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const packed = new Int16Array(buf, 0, manifest.vertices * 3);
        const index = new Uint16Array(buf, manifest.vertices * 6, manifest.indices);
        const out: Bones = new Map();
        for (const m of manifest.meshes) {
          const pos = new Float32Array(m.v[1] * 3);
          for (let i = 0; i < pos.length; i++) pos[i] = packed[m.v[0] * 3 + i] * manifest.scale;
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          geo.setIndex(new THREE.BufferAttribute(index.slice(m.i[0], m.i[0] + m.i[1]), 1));
          geo.computeVertexNormals();
          geo.computeBoundingSphere();
          out.set(m.fma, geo);
        }
        return out;
      });
    loads.set(url, load);
  }
  return load;
}

export function useBones(url: string, manifest: Manifest) {
  const [bones, setBones] = useState<Bones | null>(null);
  useEffect(() => {
    let live = true;
    loadBones(url, manifest).then(
      (b) => live && setBones(b),
      () => loads.delete(url),
    );
    return () => {
      live = false;
    };
  }, [url, manifest]);
  return bones;
}

// ── The printed bone ──────────────────────────────────────────────────────────
const HALFTONE_KEY = () => "codex-halftone";
const OUTLINE_KEY = () => "codex-bone-outline";
/** An ink contour: the bone's back faces, pushed out a hair along their normals. */
function outline(shader: { vertexShader: string }) {
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * 0.007;");
}

/** Set in a sawn view: everything on the far side of these planes is cut away. */
export const CutContext = createContext<THREE.Plane[] | null>(null);

export function Bone({ geo, color = BONE }: { geo: THREE.BufferGeometry; color?: string }) {
  const { lit, dimmed } = useLook();
  const cut = useContext(CutContext);
  return (
    <>
      <mesh geometry={geo} castShadow={!dimmed} receiveShadow>
        <meshStandardMaterial
          onBeforeCompile={halftone}
          customProgramCacheKey={HALFTONE_KEY}
          color={lit ? SPOT : color}
          roughness={0.95}
          metalness={0}
          transparent={dimmed}
          opacity={dimmed ? 0.12 : 1}
          depthWrite={!dimmed}
          side={cut ? THREE.DoubleSide : THREE.FrontSide}
          clippingPlanes={cut}
        />
      </mesh>
      {!dimmed && (
        <mesh geometry={geo} raycast={() => null}>
          <meshBasicMaterial onBeforeCompile={outline} customProgramCacheKey={OUTLINE_KEY} color={lit ? SPOT : INK} side={THREE.BackSide} clippingPlanes={cut} />
        </mesh>
      )}
    </>
  );
}

/** A bone that drifts its own way when the room opens, carrying its part's label if given one. */
export function Drift({ by, children, labelFor }: { by: Vec3; children: ReactNode; labelFor?: { id: string; at: Vec3 } }) {
  const ref = useRef<THREE.Group>(null);
  const explode = useExplode();
  useFrame(() => ref.current?.position.set(by[0] * explode.current, by[1] * explode.current, by[2] * explode.current));
  return (
    <group ref={ref}>
      {children}
      {labelFor && (
        <group
          position={labelFor.at}
          ref={(o) => {
            if (o) labelAnchors.set(labelFor.id, o);
            else labelAnchors.delete(labelFor.id);
          }}
        />
      )}
    </group>
  );
}
