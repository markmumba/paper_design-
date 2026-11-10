/*
 * Physical simulation of a sheet of paper being crumpled into a ball.
 *
 * Paper behaves very differently from cloth or rubber, and each of these
 * properties is modelled explicitly (position-based dynamics):
 *
 *  - Inextensible: paper barely stretches or compresses in-plane, so every
 *    edge and diagonal of the mesh is a hard distance constraint. All
 *    crumpling therefore happens by bending out of plane, which is what
 *    produces large flat facets separated by sharp ridges.
 *  - Plastic bending: paper has some bending stiffness, but once a bend
 *    passes a yield strain the fibres break and the fold stays. Bending
 *    constraints update their own rest length when over-strained, so
 *    creases are permanent and the ball does not spring back open.
 *  - No interpenetration: layers of paper stack instead of passing through
 *    each other, which is why a real crumpled ball is mostly air.
 *  - A table: the sheet starts lying flat and cannot go below it.
 *  - Hands: a shrinking spherical boundary squeezes the sheet. It reaches the
 *    corners first, then the edges, then the middle, just as real hands do.
 *
 * The result is a set of keyframes (vertex positions) so scrolling can scrub
 * forwards and backwards through the crumple deterministically.
 */

export type SimResult = {
  cols: number;
  rows: number;
  frames: Float32Array; // keyframes × vertices × 3
  keyframes: number;
  uv: Float32Array;
  index: Uint16Array;
  /** Ball radius and centre height for each keyframe (for occlusion). */
  radius: Float32Array;
  centerZ: Float32Array;
  ms: number;
};

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function simulate(aspect: number, seed = 7): SimResult {
  const t0 = performance.now();
  const ROWS = 60;
  const COLS = Math.max(10, Math.round(ROWS * aspect));
  const NX = COLS + 1;
  const NY = ROWS + 1;
  const N = NX * NY;
  const W = 2 * aspect;
  const H = 2;
  const spacing = H / ROWS;
  const rand = rng(seed);

  const x = new Float32Array(N * 3);
  const xp = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const id = j * NX + i;
      const u = i / COLS;
      const v = j / ROWS;
      uv[id * 2] = u;
      uv[id * 2 + 1] = v;
      x[id * 3] = (u - 0.5) * W;
      x[id * 3 + 1] = (v - 0.5) * H;
      x[id * 3 + 2] = 0;
    }
  }

  // Constraints: stretch (structural + shear) are hard; bend (skip-one) are soft and plastic.
  const sA: number[] = [];
  const sB: number[] = [];
  const bA: number[] = [];
  const bB: number[] = [];
  const lA: number[] = [];
  const lB: number[] = [];
  const at = (i: number, j: number) => j * NX + i;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      if (i + 1 < NX) {
        sA.push(at(i, j));
        sB.push(at(i + 1, j));
      }
      if (j + 1 < NY) {
        sA.push(at(i, j));
        sB.push(at(i, j + 1));
      }
      if (i + 1 < NX && j + 1 < NY) {
        sA.push(at(i, j), at(i + 1, j));
        sB.push(at(i + 1, j + 1), at(i, j + 1));
      }
      if (i + 2 < NX) {
        bA.push(at(i, j));
        bB.push(at(i + 2, j));
      }
      if (j + 2 < NY) {
        bA.push(at(i, j));
        bB.push(at(i, j + 2));
      }
      if (i + 2 < NX && j + 2 < NY) {
        bA.push(at(i, j), at(i + 2, j));
        bB.push(at(i + 2, j + 2), at(i, j + 2));
      }
      // Longer-range bending: real paper resists wrinkling at tiny wavelengths,
      // so the first folds are broad and only later break up into finer creases.
      if (i + 5 < NX) {
        lA.push(at(i, j));
        lB.push(at(i + 5, j));
      }
      if (j + 5 < NY) {
        lA.push(at(i, j));
        lB.push(at(i, j + 5));
      }
    }
  }
  const restLen = (a: number[], b: number[]) =>
    Float32Array.from(a, (p, k) => {
      const q = b[k];
      return Math.hypot(x[p * 3] - x[q * 3], x[p * 3 + 1] - x[q * 3 + 1]);
    });
  const SA = Int32Array.from(sA);
  const SB = Int32Array.from(sB);
  const SL = restLen(sA, sB);
  const BA = Int32Array.from(bA);
  const BB = Int32Array.from(bB);
  const BL = restLen(bA, bB);
  const LA = Int32Array.from(lA);
  const LB = Int32Array.from(lB);
  const LL = restLen(lA, lB);

  // Frame 0 is the exact flat page, so the hand-off from the live DOM is seamless.
  const KEYFRAMES = 96;
  const frames = new Float32Array(KEYFRAMES * N * 3);
  frames.set(x, 0);

  // Gentle, smooth unevenness (a sheet never lies perfectly flat) so the first
  // buckles are broad. Per-vertex noise here would seed mesh-sized wrinkles.
  const ph = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  for (let p = 0; p < N; p++) {
    const px = x[p * 3];
    const py = x[p * 3 + 1];
    x[p * 3 + 2] =
      0.012 * (1 + Math.sin(px * 1.3 + ph[0]) * Math.sin(py * 1.1 + ph[1])) +
      0.006 * (1 + Math.sin(px * 2.9 + ph[2]) * Math.sin(py * 3.3 + ph[3])) +
      0.003 * (1 + Math.sin(px * 6.1 + ph[4]) * Math.sin(py * 5.7 + ph[5]));
  }
  xp.set(x);

  const cornerR = Math.hypot(aspect, 1) * 1.001;
  const area = W * H;
  const endR = Math.max(0.3, Math.min(0.46, Math.sqrt(area) * 0.17));
  const radius = new Float32Array(KEYFRAMES);
  const centerZ = new Float32Array(KEYFRAMES);
  radius[0] = cornerR;

  const SUB = 3;
  const ITER = 8;
  const BEND_K = 0.3;
  const LONG_K = 0.12;
  const YIELD = 0.03;
  const LONG_YIELD = 0.06;
  const PLASTIC = 0.5;
  const DAMP = 0.94;
  const minD = spacing * 0.55;
  const minD2 = minD * minD;

  // Spatial hash for self-collision.
  const TABLE = 1 << 15;
  const head = new Int32Array(TABLE);
  const next = new Int32Array(N);
  const hash = (ix: number, iy: number, iz: number) => ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & (TABLE - 1);
  const iOf = new Int32Array(N);
  const jOf = new Int32Array(N);
  for (let p = 0; p < N; p++) {
    iOf[p] = p % NX;
    jOf[p] = Math.floor(p / NX);
  }

  const project = (A: Int32Array, B: Int32Array, L: Float32Array, k: number, yieldAt = 0) => {
    for (let c = 0; c < A.length; c++) {
      const a = A[c] * 3;
      const b = B[c] * 3;
      const dx = x[b] - x[a];
      const dy = x[b + 1] - x[a + 1];
      const dz = x[b + 2] - x[a + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      const rest = L[c];
      if (yieldAt) {
        // Past the yield point the fold sets: the rest length follows the bend.
        const strain = (len - rest) / rest;
        if (strain > yieldAt || strain < -yieldAt) L[c] = Math.max(rest * 0.05, rest + (len - rest) * PLASTIC);
      }
      const s = ((len - L[c]) / len) * 0.5 * k;
      x[a] += dx * s;
      x[a + 1] += dy * s;
      x[a + 2] += dz * s;
      x[b] -= dx * s;
      x[b + 1] -= dy * s;
      x[b + 2] -= dz * s;
    }
  };

  const collideSelf = () => {
    head.fill(-1);
    for (let p = 0; p < N; p++) {
      const h = hash(Math.floor(x[p * 3] / minD), Math.floor(x[p * 3 + 1] / minD), Math.floor(x[p * 3 + 2] / minD));
      next[p] = head[h];
      head[h] = p;
    }
    for (let p = 0; p < N; p++) {
      const px = x[p * 3];
      const py = x[p * 3 + 1];
      const pz = x[p * 3 + 2];
      const cx = Math.floor(px / minD);
      const cy = Math.floor(py / minD);
      const cz = Math.floor(pz / minD);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            for (let q = head[hash(cx + ox, cy + oy, cz + oz)]; q !== -1; q = next[q]) {
              if (q <= p) continue;
              // Mesh neighbours are already held apart by the constraints.
              if (Math.abs(iOf[p] - iOf[q]) <= 2 && Math.abs(jOf[p] - jOf[q]) <= 2) continue;
              const dx = x[q * 3] - px;
              const dy = x[q * 3 + 1] - py;
              const dz = x[q * 3 + 2] - pz;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= minD2 || d2 < 1e-12) continue;
              const d = Math.sqrt(d2);
              const s = ((minD - d) / d) * 0.5;
              x[p * 3] -= dx * s;
              x[p * 3 + 1] -= dy * s;
              x[p * 3 + 2] -= dz * s;
              x[q * 3] += dx * s;
              x[q * 3 + 1] += dy * s;
              x[q * 3 + 2] += dz * s;
            }
          }
        }
      }
    }
  };

  for (let k = 1; k < KEYFRAMES; k++) {
    // Squeeze over the first ~85% of keyframes, then let the ball settle.
    const e = 1 - Math.pow(1 - Math.min(1, k / (KEYFRAMES * 0.85)), 1.7);
    const R = cornerR + (endR - cornerR) * e;
    const czTarget = endR * 0.62 * Math.min(1, e * 1.6);
    // Cupped hands don't only squeeze from the rim: they press the whole wad
    // towards its middle, lifting and folding the centre of the sheet as well.
    const pull = 0.0016 * Math.pow(e, 1.4);
    radius[k] = R;
    centerZ[k] = czTarget;

    for (let s = 0; s < SUB; s++) {
      // Verlet integration with damping (no gravity: the hands hold it).
      for (let q = 0; q < N * 3; q++) {
        const v = (x[q] - xp[q]) * DAMP;
        xp[q] = x[q];
        x[q] += v;
      }
      for (let it = 0; it < ITER; it++) {
        project(SA, SB, SL, 1);
        if (it % 2 === 0) {
          project(BA, BB, BL, BEND_K, YIELD);
          project(LA, LB, LL, LONG_K, LONG_YIELD);
        }
      }
      // Hands: anything outside the shrinking sphere is pushed in, with friction.
      for (let p = 0; p < N; p++) {
        const o = p * 3;
        x[o] -= x[o] * pull;
        x[o + 1] -= x[o + 1] * pull;
        x[o + 2] += (czTarget - x[o + 2]) * pull;
        const dx = x[o];
        const dy = x[o + 1];
        const dz = x[o + 2] - czTarget;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > R) {
          const f = R / d;
          x[o] = dx * f;
          x[o + 1] = dy * f;
          x[o + 2] = czTarget + dz * f;
          xp[o] += (x[o] - xp[o]) * 0.5;
          xp[o + 1] += (x[o + 1] - xp[o + 1]) * 0.5;
          xp[o + 2] += (x[o + 2] - xp[o + 2]) * 0.5;
        }
        // The table.
        if (x[o + 2] < 0) {
          x[o + 2] = 0;
          xp[o + 2] = 0;
          xp[o] += (x[o] - xp[o]) * 0.4;
          xp[o + 1] += (x[o + 1] - xp[o + 1]) * 0.4;
        }
      }
      collideSelf();
      // Re-assert inextensibility after collisions moved things around.
      project(SA, SB, SL, 1);
    }
    frames.set(x, k * N * 3);
  }

  // Alternate the diagonal so the mesh has no directional bias.
  const index = new Uint16Array(COLS * ROWS * 6);
  let n = 0;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i, j + 1);
      const d = at(i + 1, j + 1);
      if ((i + j) % 2) index.set([a, b, d, a, d, c], n);
      else index.set([a, b, c, b, d, c], n);
      n += 6;
    }
  }

  return { cols: COLS, rows: ROWS, frames, keyframes: KEYFRAMES, uv, index, radius, centerZ, ms: performance.now() - t0 };
}
