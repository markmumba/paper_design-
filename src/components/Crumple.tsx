"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import type { SimResult } from "@/lib/crumpleSim";

/*
 * Crumples a folio into a paper ball as you scroll past it.
 *
 * The motion is not keyframed by hand: a physical paper simulation
 * (src/lib/crumpleSim.ts) runs once in a web worker, and scrolling scrubs
 * through its keyframes. This component only renders the result:
 *
 *   1. The finished folio is snapshotted to a canvas and used as the paper's
 *      texture, so the sheet you see crumpling is the page you were reading.
 *   2. A soft shadow is cast onto the desk (the page behind) by projecting
 *      the sheet along the light direction and blurring it.
 *   3. The paper is lit with wrapped diffuse light (paper is matte and
 *      scatters light), crease-sharpened normals, and occlusion that darkens
 *      the folds deep inside the ball. The back of the sheet shows a faint
 *      trace of the ink soaking through.
 */

// ── Simulation cache: one run per viewport aspect and seed, shared by folios ──
const sims = new Map<string, Promise<SimResult>>();

function getSim(aspect: number, seed: number): Promise<SimResult> {
  const key = `${aspect.toFixed(2)}:${seed}`;
  let job = sims.get(key);
  if (!job) {
    job = new Promise<SimResult>((resolve, reject) => {
      const fallback = () =>
        import("@/lib/crumpleSim").then(({ simulate }) => resolve(simulate(aspect, seed)), reject);
      try {
        const worker = new Worker(new URL("../lib/crumple.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (e: MessageEvent<SimResult>) => {
          resolve(e.data);
          worker.terminate();
        };
        worker.onerror = () => {
          worker.terminate();
          void fallback();
        };
        worker.postMessage({ aspect, seed });
      } catch {
        void fallback();
      }
    });
    sims.set(key, job);
  }
  return job;
}

// ── Shaders ─────────────────────────────────────────────────────────────────
const PAPER_VS = /* glsl */ `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec2 aUv;
uniform float uAspect;
out vec3 vPos;
out vec3 vN;
out vec2 vUv;
const float D = 3.4;
void main(){
  vPos = aPos; vN = aNormal; vUv = aUv;
  gl_Position = vec4(aPos.x/uAspect, aPos.y, -aPos.z*0.2, (D - aPos.z)/D);
}`;

const PAPER_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vN;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uCrumple;
uniform vec3 uBallC;
uniform float uBallR;
out vec4 outColor;
const vec3 L = normalize(vec3(-0.35, 0.45, 0.82));
void main(){
  // Blend the smooth normal with the true facet normal: flat panels stay flat,
  // and ridges between them stay crisp.
  vec3 sn = normalize(vN);
  vec3 fn = normalize(cross(dFdx(vPos), dFdy(vPos)));
  if (dot(fn, sn) < 0.0) fn = -fn;
  vec3 n = normalize(mix(sn, fn, 0.4));
  if (!gl_FrontFacing) n = -n;

  // Matte paper: wrapped diffuse, normalised so the untouched page keeps its tone.
  float wrap = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
  float flatRef = (L.z + 0.35) / 1.35;
  float shade = 1.0 + 0.95 * (wrap - flatRef);

  // Folds buried inside the ball receive less light.
  float depth = clamp(length(vPos - uBallC) / max(uBallR, 0.001), 0.0, 1.0);
  float ao = mix(1.0, mix(0.5, 1.0, smoothstep(0.3, 1.0, depth)), uCrumple);

  vec3 paper = vec3(0.914, 0.855, 0.725);
  vec3 ink = texture(uTex, vUv).rgb;
  // The back of the sheet: plain paper with a faint ghost of the ink soaking through.
  vec3 col = gl_FrontFacing ? ink : mix(paper * 0.97, ink, 0.14);
  // Light scattered inside the fibres keeps shadows on paper warm rather than grey.
  float lum = clamp(shade * ao, 0.0, 1.2);
  vec3 tint = mix(vec3(0.62, 0.48, 0.33), vec3(1.0), smoothstep(0.35, 1.0, lum));
  col *= lum * tint;
  outColor = vec4(col, 1.0);
}`;

const SHADOW_VS = /* glsl */ `#version 300 es
in vec3 aPos;
uniform float uAspect;
const vec3 L = normalize(vec3(-0.35, 0.45, 0.82));
void main(){
  // Project each point down onto the desk along the light direction.
  vec2 s = aPos.xy - L.xy * (aPos.z / L.z);
  gl_Position = vec4(s.x/uAspect, s.y, 0.0, 1.0);
}`;

const SHADOW_FS = /* glsl */ `#version 300 es
precision mediump float;
out vec4 outColor;
void main(){ outColor = vec4(1.0); }`;

const BLUR_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uShadow;
uniform vec2 uTexel;
uniform float uStrength;
out vec4 outColor;
void main(){
  float a = 0.0;
  float total = 0.0;
  for (int y = -3; y <= 3; y++) {
    for (int x = -3; x <= 3; x++) {
      float w = exp(-float(x*x + y*y) / 6.0);
      a += texture(uShadow, vUv + vec2(float(x), float(y)) * uTexel * 1.6).r * w;
      total += w;
    }
  }
  a = a / total * uStrength;
  // Warm umber shadow on paper, premultiplied.
  outColor = vec4(vec3(0.23, 0.15, 0.08) * a, a);
}`;

// ── GL plumbing ─────────────────────────────────────────────────────────────
function program(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}

type Scene = {
  gl: WebGL2RenderingContext;
  paper: WebGLProgram;
  shadow: WebGLProgram;
  blur: WebGLProgram;
  paperVao: WebGLVertexArrayObject;
  shadowVao: WebGLVertexArrayObject;
  posBuf: WebGLBuffer;
  nrmBuf: WebGLBuffer;
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  fboTex: WebGLTexture;
  fboSize: [number, number];
  count: number;
  sim: SimResult;
  pos: Float32Array;
  nrm: Float32Array;
};

function buildScene(canvas: HTMLCanvasElement, sim: SimResult, snap: HTMLCanvasElement): Scene | null {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;
  const paper = program(gl, PAPER_VS, PAPER_FS);
  const shadow = program(gl, SHADOW_VS, SHADOW_FS);
  const blur = program(gl, BLUR_VS, BLUR_FS);
  const N = (sim.cols + 1) * (sim.rows + 1);

  const posBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, N * 12, gl.DYNAMIC_DRAW);
  const nrmBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
  gl.bufferData(gl.ARRAY_BUFFER, N * 12, gl.DYNAMIC_DRAW);
  const uvBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, sim.uv, gl.STATIC_DRAW);
  const idxBuf = gl.createBuffer()!;

  const attach = (prog: WebGLProgram, name: string, buf: WebGLBuffer, size: number) => {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  const paperVao = gl.createVertexArray()!;
  gl.bindVertexArray(paperVao);
  attach(paper, "aPos", posBuf, 3);
  attach(paper, "aNormal", nrmBuf, 3);
  attach(paper, "aUv", uvBuf, 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sim.index, gl.STATIC_DRAW);
  const shadowVao = gl.createVertexArray()!;
  gl.bindVertexArray(shadowVao);
  attach(shadow, "aPos", posBuf, 3);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bindVertexArray(null);

  const texture = (src?: HTMLCanvasElement) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, src ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (src) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    return t;
  };
  const tex = texture(snap);
  const fboTex = texture();
  const fbo = gl.createFramebuffer()!;

  return {
    gl,
    paper,
    shadow,
    blur,
    paperVao,
    shadowVao,
    posBuf,
    nrmBuf,
    tex,
    fbo,
    fboTex,
    fboSize: [0, 0],
    count: sim.index.length,
    sim,
    pos: new Float32Array(N * 3),
    nrm: new Float32Array(N * 3),
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

/** Fill scene.pos with the sheet at crumple `t` (0..1), then toss it rigidly. */
function pose(scene: Scene, t: number, toss: number, aspect: number) {
  const { sim, pos } = scene;
  const N = pos.length / 3;
  const f = t * (sim.keyframes - 1);
  const k0 = Math.floor(f);
  const k1 = Math.min(sim.keyframes - 1, k0 + 1);
  const w = f - k0;
  const a = sim.frames.subarray(k0 * N * 3, (k0 + 1) * N * 3);
  const b = sim.frames.subarray(k1 * N * 3, (k1 + 1) * N * 3);
  for (let i = 0; i < N * 3; i++) pos[i] = a[i] + (b[i] - a[i]) * w;

  const R = sim.radius[k0] + (sim.radius[k1] - sim.radius[k0]) * w;
  const cz = sim.centerZ[k0] + (sim.centerZ[k1] - sim.centerZ[k0]) * w;
  const ball = [0, 0, cz];
  if (toss > 0) {
    // Picked up and lobbed away: rigid spin about the ball's centre plus an arc.
    const ang = toss * 7;
    const ax = [0.8, 0.5, 0.33];
    const len = Math.hypot(ax[0], ax[1], ax[2]);
    const [ux, uy, uz] = ax.map((v) => v / len);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const m = [
      c + ux * ux * (1 - c), ux * uy * (1 - c) - uz * s, ux * uz * (1 - c) + uy * s,
      uy * ux * (1 - c) + uz * s, c + uy * uy * (1 - c), uy * uz * (1 - c) - ux * s,
      uz * ux * (1 - c) - uy * s, uz * uy * (1 - c) + ux * s, c + uz * uz * (1 - c),
    ];
    const tx = toss * 1.7 * aspect;
    const ty = -toss * 0.9;
    const tz = Math.sin(toss * Math.PI) * 0.9;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const px = pos[o];
      const py = pos[o + 1];
      const pz = pos[o + 2] - cz;
      pos[o] = m[0] * px + m[1] * py + m[2] * pz + tx;
      pos[o + 1] = m[3] * px + m[4] * py + m[5] * pz + ty;
      pos[o + 2] = m[6] * px + m[7] * py + m[8] * pz + cz + tz;
    }
    ball[0] = tx;
    ball[1] = ty;
    ball[2] = cz + tz;
  }
  return { ball, R };
}

function computeNormals(scene: Scene) {
  const { pos, nrm, sim } = scene;
  nrm.fill(0);
  const idx = sim.index;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const e1x = pos[b] - pos[a];
    const e1y = pos[b + 1] - pos[a + 1];
    const e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a];
    const e2y = pos[c + 1] - pos[a + 1];
    const e2z = pos[c + 2] - pos[a + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      nrm[v] += nx;
      nrm[v + 1] += ny;
      nrm[v + 2] += nz;
    }
  }
}

function render(scene: Scene, canvas: HTMLCanvasElement, v: number) {
  const { gl } = scene;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const aspect = w / h;
  const crumple = range(v, 0, 0.8);
  const toss = range(v, 0.82, 1);
  const { ball, R } = pose(scene, crumple, toss * toss, aspect);
  computeNormals(scene);
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.posBuf);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, scene.pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.nrmBuf);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, scene.nrm);

  // 1. Shadow silhouette into a quarter-resolution target.
  const sw = Math.max(1, Math.round(w / 4));
  const sh = Math.max(1, Math.round(h / 4));
  if (scene.fboSize[0] !== sw || scene.fboSize[1] !== sh) {
    gl.bindTexture(gl.TEXTURE_2D, scene.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scene.fboTex, 0);
    scene.fboSize = [sw, sh];
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
  gl.viewport(0, 0, sw, sh);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.useProgram(scene.shadow);
  gl.uniform1f(gl.getUniformLocation(scene.shadow, "uAspect"), aspect);
  gl.bindVertexArray(scene.shadowVao);
  gl.drawElements(gl.TRIANGLES, scene.count, gl.UNSIGNED_SHORT, 0);

  // 2. Blurred shadow onto the (transparent) canvas, over the desk behind it.
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(scene.blur);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, scene.fboTex);
  gl.uniform1i(gl.getUniformLocation(scene.blur, "uShadow"), 0);
  gl.uniform2f(gl.getUniformLocation(scene.blur, "uTexel"), 1 / sw, 1 / sh);
  // A lifted ball casts a lighter, more diffuse shadow.
  gl.uniform1f(gl.getUniformLocation(scene.blur, "uStrength"), 0.42 * (1 - 0.5 * Math.sin(toss * Math.PI)));
  gl.bindVertexArray(null);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // 3. The paper itself.
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.useProgram(scene.paper);
  gl.uniform1f(gl.getUniformLocation(scene.paper, "uAspect"), aspect);
  gl.uniform1f(gl.getUniformLocation(scene.paper, "uCrumple"), range(crumple, 0.35, 1));
  gl.uniform3f(gl.getUniformLocation(scene.paper, "uBallC"), ball[0], ball[1], ball[2]);
  gl.uniform1f(gl.getUniformLocation(scene.paper, "uBallR"), R);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, scene.tex);
  gl.uniform1i(gl.getUniformLocation(scene.paper, "uTex"), 0);
  gl.bindVertexArray(scene.paperVao);
  gl.drawElements(gl.TRIANGLES, scene.count, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);
}

export function Crumple({
  c,
  ready,
  contentRef,
  seed,
}: {
  /** Crumple progress, 0 (flat page) to 1 (ball gone). */
  c: MotionValue<number>;
  /** Becomes > 0.99 once the drawing has finished; triggers the snapshot. */
  ready: MotionValue<number>;
  contentRef: RefObject<HTMLDivElement | null>;
  seed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const snap = useRef<HTMLCanvasElement | null>(null);
  const sim = useRef<SimResult | null>(null);
  const busy = useRef(false);
  const failed = useRef(false);

  const aspectNow = () => {
    const el = contentRef.current;
    return el ? el.clientWidth / Math.max(1, el.clientHeight) : 16 / 10;
  };

  const draw = (v: number) => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;
    if (failed.current) {
      content.style.opacity = String(1 - v);
      return;
    }
    if (!scene.current && snap.current && sim.current) {
      try {
        scene.current = buildScene(canvas, sim.current, snap.current);
        if (!scene.current) failed.current = true;
      } catch {
        failed.current = true;
      }
    }
    const active = v > 0.0005 && !!scene.current;
    // Swap the live page for its paper double only while it is crumpling.
    content.style.visibility = active ? "hidden" : "";
    canvas.style.visibility = active ? "visible" : "hidden";
    if (active) render(scene.current!, canvas, v);
  };

  const prepare = async () => {
    const content = contentRef.current;
    if (!content || busy.current || failed.current || (snap.current && sim.current)) return;
    busy.current = true;
    try {
      const [{ domToCanvas }, result] = await Promise.all([import("modern-screenshot"), getSim(aspectNow(), seed)]);
      sim.current = result;
      if (!snap.current) {
        snap.current = await domToCanvas(content, {
          scale: Math.min(window.devicePixelRatio || 1, 2),
          backgroundColor: "#e9dab9",
          // Leave the magnifier out of the snapshot if it happens to be open.
          filter: (el) => !(el instanceof Element && el.hasAttribute("data-no-snap")),
        });
      }
      draw(c.get());
    } catch {
      failed.current = true;
    } finally {
      busy.current = false;
    }
  };

  // Warm the simulation up in the background as soon as the page is idle.
  useEffect(() => {
    const id = window.setTimeout(() => void getSim(aspectNow(), seed), 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useMotionValueEvent(ready, "change", (v) => {
    if (v > 0.99) void prepare();
  });
  useMotionValueEvent(c, "change", (v) => {
    if (v > 0 && !scene.current) void prepare();
    draw(v);
  });

  // A resize changes the page layout and aspect, so start again from scratch.
  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        scene.current = null;
        snap.current = null;
        sim.current = null;
        if (canvasRef.current) canvasRef.current.style.visibility = "hidden";
        if (contentRef.current) contentRef.current.style.visibility = "";
        if (c.get() > 0 || ready.get() > 0.99) void prepare();
      }, 250);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      style={{ visibility: "hidden" }}
    />
  );
}
