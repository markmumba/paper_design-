"use client";

import * as THREE from "three";
import { halftone, INK, SPOT, useLook } from "@/components/explore/kit";

/*
 * A muscle printed the way Leonardo drew one: its own tone, a firm ink
 * contour, and fibre lines hatched along it, running from end to end and
 * gathering where it narrows into tendon.
 *
 * The fibre lines need to know which way the muscle runs. Each mesh is
 * measured once, its long axis found by principal components, and every
 * vertex given its place round and along that axis (the `fib` attribute):
 * lines of constant angle round the axis are then the fibres.
 */

/** Long axis of a mesh, by power iteration on its covariance. */
function axisOf(pos: THREE.BufferAttribute) {
  const n = pos.count;
  const c = new THREE.Vector3();
  for (let i = 0; i < n; i++) c.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  c.multiplyScalar(1 / n);
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const d = [pos.getX(i) - c.x, pos.getY(i) - c.y, pos.getZ(i) - c.z];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m[r * 3 + k] += d[r] * d[k];
  }
  let v = new THREE.Vector3(0.3, 1, 0.2).normalize();
  for (let it = 0; it < 24; it++) {
    const x = m[0] * v.x + m[1] * v.y + m[2] * v.z;
    const y = m[3] * v.x + m[4] * v.y + m[5] * v.z;
    const z = m[6] * v.x + m[7] * v.y + m[8] * v.z;
    v = new THREE.Vector3(x, y, z).normalize();
  }
  return { c, axis: v };
}

/** Give a muscle its fibre coordinates, once. */
export function addFibres(geo: THREE.BufferGeometry) {
  if (geo.getAttribute("fib")) return;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const { c, axis } = axisOf(pos);
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(axis)) > 0.9) u.set(0, 0, 1);
  u.sub(axis.clone().multiplyScalar(u.dot(axis))).normalize();
  const w = new THREE.Vector3().crossVectors(axis, u);
  let half = 0;
  const along: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getX(i) - c.x) * axis.x + (pos.getY(i) - c.y) * axis.y + (pos.getZ(i) - c.z) * axis.z;
    along.push(t);
    half = Math.max(half, Math.abs(t));
  }
  const fib = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const d = new THREE.Vector3(pos.getX(i) - c.x, pos.getY(i) - c.y, pos.getZ(i) - c.z);
    fib[i * 3] = d.dot(u);
    fib[i * 3 + 1] = along[i] / (half || 1);
    fib[i * 3 + 2] = d.dot(w);
  }
  geo.setAttribute("fib", new THREE.BufferAttribute(fib, 3));
}

const FIBRE_KEY = () => "codex-muscle-fibres";
function fibres(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute vec3 fib;\nvarying vec3 vFib;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFib = fib;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vFib;");
  halftone(shader);
  shader.fragmentShader = shader.fragmentShader.replace(
    "gl_FragColor = vec4(printed, diffuseColor.a);",
    /* glsl */ `
    // Fibres: lines of constant angle round the muscle's long axis.
    float sv = fract(atan(vFib.z, vFib.x) * 3.1831 + 0.5);
    float fw = min(fwidth(sv), 0.2);
    float fibre = smoothstep(0.33 - fw, 0.33 + fw, abs(sv - 0.5));
    // They thin out towards the tendons at the ends.
    fibre *= 1.0 - smoothstep(0.8, 1.0, abs(vFib.y));
    printed = mix(printed, vec3(0.3, 0.1, 0.06), fibre * (0.55 + 0.4 * shade));
    // The muscle's edge, where it turns away, darkens like a drawn contour.
    gl_FragColor = vec4(printed, diffuseColor.a);
    `,
  );
}

const OUTLINE_KEY = () => "codex-muscle-outline";
/** The contour: back faces pushed out along their normals, thicker than a bone's. */
function outline(shader: { vertexShader: string }) {
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * 0.011;");
}

export function Muscle({ geo, color }: { geo: THREE.BufferGeometry; color: string }) {
  const { lit, dimmed } = useLook();
  return (
    <>
      <mesh geometry={geo} castShadow={!dimmed} receiveShadow>
        <meshStandardMaterial
          onBeforeCompile={fibres}
          customProgramCacheKey={FIBRE_KEY}
          // Picked, a muscle keeps its own tone and fibres; its contour turns red.
          color={color}
          roughness={0.9}
          // Two-sided, so the small holes left by simplifying the mesh show muscle, not the ink behind.
          side={THREE.DoubleSide}
          metalness={0}
          transparent={dimmed}
          opacity={dimmed ? 0.12 : 1}
          depthWrite={!dimmed}
          // Each muscle's own surface wins over a neighbour's contour where they touch.
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {!dimmed && (
        <mesh geometry={geo} raycast={() => null}>
          <meshBasicMaterial onBeforeCompile={outline} customProgramCacheKey={OUTLINE_KEY} color={lit ? SPOT : INK} side={THREE.BackSide} />
        </mesh>
      )}
    </>
  );
}

/** A tone for each muscle, varied within its group so neighbours read apart. */
export function toneOf(base: string, fma: string) {
  let h = 0;
  for (let i = 0; i < fma.length; i++) h = (h * 31 + fma.charCodeAt(i)) >>> 0;
  const k = [-0.07, 0, 0.06, -0.03, 0.04][h % 5];
  const c = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return `#${c.setHSL(hsl.h, Math.min(1, hsl.s * (1 + k)), Math.min(0.9, Math.max(0.3, hsl.l + k))).getHexString()}`;
}
