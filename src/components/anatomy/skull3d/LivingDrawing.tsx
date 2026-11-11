"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FollowCamera, type Subject, type ViewDef } from "@/components/explore/ExploreRoom";
import { PAPER } from "@/components/explore/kit";
import { useBones, type Manifest } from "../bones3d";

/*
 * Il disegno vivo: the living drawing.
 *
 * Leonardo's own page of 1489, the skull from the front with the front of
 * one half sawn away, stands before you. Then his ink lets go of the paper
 * and the same skull rises out of it in three dimensions, at the same size,
 * in the same place, cut the same way. It turns a little, as if to show you
 * it is solid, and settles back into his page.
 *
 * The solid skull is not shaded like a model. A shader draws it, every
 * frame, in pen hatching: parallel strokes laid where the light falls away,
 * a second layer in the deepest shadow, broken where a pen would lift. The
 * strokes run from upper left to lower right, the way a left-handed man
 * hatches, as Leonardo did. Turn it and it is redrawn from the new side.
 */

export const LIVING_VIEWS: ViewDef[] = [
  { id: "foglio", it: "Il foglio", en: "His page, coming alive", offset: [0, 0, 7.2] },
  { id: "gira", it: "Gira", en: "Turning in his hand", offset: [0, 0.4, 6.2] },
  { id: "taglio", it: "Nel taglio", en: "Into the cut", offset: [-3.6, 0.4, 3.9] },
  { id: "libera", it: "Libera", en: "Free", offset: [3.5, 1.2, 5] },
];

// The page: his traced ink, the skull filling its width (see ../traced).
// It stands in the skull's own middle plane and is drawn over it, so the two match in size.
const PAGE = { href: "/anatomy/skull.webp", w: 1.8, h: 1.8 * (740 / 510), y: 0.01, z: 0 };
/** The saw: the front of the viewer's left half is cut away, as on his sheet. */
const CUT_DEPTH = 0.55;

// One loop: the page, the page coming alive, the solid turning, back to the page.
const LOOP = 13;
function phase(t: number) {
  const u = t % LOOP;
  const ease = (x: number) => x * x * (3 - 2 * x);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  // How solid the skull is (0: only his page), and how far it has turned.
  const solid = u < 2.6 ? 0 : u < 4.2 ? ease((u - 2.6) / 1.6) : u < 10.8 ? 1 : 1 - ease(clamp((u - 10.8) / 1.6));
  const turn = u < 4.6 || u > 10.4 ? 0 : Math.sin(((u - 4.6) / 5.8) * Math.PI * 2) * 0.55 * Math.sin(((u - 4.6) / 5.8) * Math.PI);
  return { solid, turn };
}

// ── The pen ───────────────────────────────────────────────────────────────────
const HATCH_KEY = () => "codex-left-hand-hatch";
function hatch(shader: { fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, fade: THREE.IUniform) {
  shader.uniforms.uFade = fade;
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform float uFade;")
    .replace(
      "#include <opaque_fragment>",
      /* glsl */ `
      float albedoLum = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.02);
      float lightLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114)) / albedoLum;
      float shade = clamp(0.98 - lightLum, 0.0, 1.0);
      // Inside the cut, the hollows are dark.
      if (!gl_FrontFacing) shade = max(shade, 0.78);
      vec2 p = gl_FragCoord.xy;
      // Strokes from upper left to lower right: lines of constant x + y.
      float s1 = (p.x + p.y) / 6.5;
      float row = floor(s1);
      float h = fract(sin(row * 12.9898) * 43758.5453);
      // A pen lifts now and then along a stroke.
      float lift = step(0.16 + 0.1 * h, fract((p.x - p.y) / (70.0 + 50.0 * h) + h * 7.0));
      float w1 = smoothstep(0.22, 0.9, shade) * 0.32;
      float d1 = abs(fract(s1) - 0.5);
      float ink1 = (1.0 - smoothstep(w1 - 0.07, w1 + 0.07, d1)) * lift * step(0.22, shade);
      // A second, steeper layer in the deepest shadow, as he built up darks.
      float s2 = (p.x * 0.45 + p.y) / 5.0;
      float h2 = fract(sin(floor(s2) * 78.233) * 43758.5453);
      float lift2 = step(0.22, fract((p.x * 1.2 - p.y * 0.5) / (55.0 + 40.0 * h2) + h2 * 5.0));
      float w2 = smoothstep(0.62, 1.0, shade) * 0.3;
      float ink2 = (1.0 - smoothstep(w2 - 0.06, w2 + 0.06, abs(fract(s2) - 0.5))) * lift2 * step(0.62, shade);
      float ink = clamp(max(ink1, ink2 * 0.95), 0.0, 1.0);
      vec3 paper = vec3(0.914, 0.855, 0.725);
      vec3 sepia = vec3(0.29, 0.19, 0.11);
      gl_FragColor = vec4(mix(paper, sepia, ink * 0.92), uFade);
      `,
    );
}

/** The ink contour: back faces pushed out along their normals. */
const OUTLINE_KEY = () => "codex-living-outline";
function outline(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, fade: THREE.IUniform) {
  shader.uniforms.uFade = fade;
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * 0.009;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform float uFade;")
    .replace("#include <opaque_fragment>", "gl_FragColor = vec4(0.23, 0.15, 0.09, uFade);");
}

type Living = {
  fade: THREE.IUniform;
  pen: THREE.MeshStandardMaterial;
  page: THREE.MeshBasicMaterial;
  started: number | null;
  view: string;
};

/** One frame of the living drawing: written here, outside React, since it changes every frame. */
function step(st: Living, view: string, now: number, g: THREE.Group | null, paper: THREE.Mesh | null) {
  if (st.view !== view || st.started === null) {
    st.view = view;
    st.started = now;
  }
  const t = now - st.started;
  if (view === "foglio") {
    const { solid, turn } = phase(t);
    st.fade.value = solid;
    st.page.opacity = 1 - solid;
    if (g) g.rotation.y = turn;
  } else {
    // Off the page: the solid stays, and in "gira" it turns slowly in the hand.
    st.fade.value = Math.min(1, st.fade.value + 0.04);
    st.page.opacity = Math.max(0, st.page.opacity - 0.04);
    if (g) g.rotation.y = view === "gira" ? Math.sin(t * 0.35) * 1.15 : g.rotation.y * 0.92;
  }
  st.pen.depthWrite = st.fade.value > 0.5;
  if (paper) paper.visible = st.page.opacity > 0.01;
}

export function LivingDrawing({ view, url, manifest }: { view: string; url: string; manifest: Manifest }) {
  const bones = useBones(url, manifest);
  // Cutting planes are only honoured when the renderer is told to.
  const get = useThree((s) => s.get);
  useEffect(() => {
    const renderer = get().gl;
    const was = renderer.localClippingEnabled;
    renderer.localClippingEnabled = true;
    return () => {
      renderer.localClippingEnabled = was;
    };
  }, [get]);

  // The saw removes only what is both on the viewer's left and in front of the cut.
  const planes = useMemo(() => [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT_DEPTH)], []);
  const fade = useMemo<THREE.IUniform>(() => ({ value: 1 }), []);
  const materials = useMemo(() => {
    const pen = new THREE.MeshStandardMaterial({ color: "#efe4cc", roughness: 0.95, side: THREE.DoubleSide, transparent: true });
    pen.clippingPlanes = planes;
    pen.clipIntersection = true;
    pen.onBeforeCompile = (s) => hatch(s, fade);
    pen.customProgramCacheKey = HATCH_KEY;
    const line = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true });
    line.clippingPlanes = planes;
    line.clipIntersection = true;
    line.onBeforeCompile = (s) => outline(s, fade);
    line.customProgramCacheKey = OUTLINE_KEY;
    return { pen, line };
  }, [planes, fade]);

  const page = useMemo(() => {
    const tex = new THREE.TextureLoader().load(PAGE.href);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  }, []);

  const skull = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Mesh>(null);
  const living = useRef<Living | null>(null);
  useFrame(({ clock }) => {
    living.current ??= { fade, pen: materials.pen, page, started: null, view };
    step(living.current, view, clock.elapsedTime, skull.current, paper.current);
  });

  const subject = useRef<Subject>({ pos: new THREE.Vector3(0, 0, 0), yaw: 0, look: new THREE.Vector3(0, 0, 0) });
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <hemisphereLight args={["#fff4dc", "#d9c398", 1.35]} />
      {/* Light from the upper left, as in his drawing. */}
      <directionalLight position={[-4, 5, 5]} intensity={2.1} color="#fff1d6" />
      <directionalLight position={[3, -2, 2]} intensity={0.25} color="#f3e2c0" />
      <group ref={skull}>
        {bones &&
          [...bones.entries()].map(([id, geo]) => (
            <group key={id}>
              <mesh geometry={geo} material={materials.pen} />
              <mesh geometry={geo} material={materials.line} raycast={() => null} />
            </group>
          ))}
      </group>
      <mesh ref={paper} position={[0, PAGE.y, PAGE.z]} material={page} renderOrder={5} raycast={() => null}>
        <planeGeometry args={[PAGE.w, PAGE.h]} />
      </mesh>
      <FollowCamera subject={subject} view={view} views={LIVING_VIEWS} minDistance={2} maxDistance={14} />
    </>
  );
}
