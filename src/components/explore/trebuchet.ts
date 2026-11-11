/*
 * The dynamics of a hinged-counterweight trebuchet with a sling.
 *
 * Three rigid links in a vertical plane, solved from Lagrange's equations:
 *
 *   θ  the arm, turning on its axle (direction of the long arm)
 *   φ  the counterweight box, swinging on its hinge at the short end
 *   ψ  the sling, swinging from the tip of the long arm
 *
 * Every mass sits at the end of a chain of rotating links, r = P + Σ L·u(α),
 * so its velocity and acceleration follow directly, and the equations of
 * motion come out as  M(q)·q̈ = f(q, q̇)  with a 3 × 3 mass matrix. Nothing is
 * keyframed: the throw is whatever these equations give.
 *
 * The throw has the three stages of the real machine:
 *
 *   1. Trough. The stone lies in a trough under the frame. As the arm turns,
 *      the sling drags it backwards along the wood (with friction). This is a
 *      fourth equation: the stone's height is held, and the force needed to
 *      hold it is the trough's push on the stone.
 *   2. Sling. When that push drops to zero the stone lifts off and whips
 *      round behind and over the arm, the sling adding its own turn to the
 *      arm's.
 *   3. Flight. One sling cord is only looped over a prong at the arm's tip.
 *      It slips off when the stone is travelling at the angle the crew set
 *      the prong for. From then on nothing joins the stone to the machine:
 *      it is a cannonball under gravity and air drag, while the arm, the
 *      counterweight and the empty sling swing on and die down.
 *
 * Distances in metres, masses in kilograms, time in seconds. z is downrange,
 * y is up; angles are directions in that plane, measured from +z towards +y.
 */

export const G = 9.81;

export const AXLE = { z: 0, y: 4.2 };
export const LA = 5.6; // long arm, axle to tip
export const LB = 1.5; // short arm, axle to counterweight hinge
export const HC = 1.1; // hanger, hinge to the top of the box
export const SL = 4.0; // sling
export const STONE_Y = 0.3; // height of the stone's centre as it lies in the trough
export const COCK = (215 * Math.PI) / 180; // arm angle when cocked
/** The prong is set so the stone leaves climbing at this angle. */
export const RELEASE = (40 * Math.PI) / 180;

// An oak beam, tapering towards the tip, so its weight sits near the axle.
const ARM_MASS = 260;
const ARM_COM = 1.55; // centre of mass, along the long arm from the axle
const ARM_I = (ARM_MASS * (LA + LB) ** 2) / 14; // about its own centre
// A box of stones a hundred times the weight of the shot.
const CW_MASS = 1800;
const CW_COM = HC + 0.55; // hinge to the middle of the box
const CW_I = (CW_MASS * (1.3 ** 2 + 1.1 ** 2)) / 12;
// An 18 kg limestone ball is about 24 cm across.
export const STONE_MASS = 18;
const STONE_RADIUS = 0.118;
/** Air drag on the stone: ½·ρ·Cd·A / m, per metre. */
const STONE_DRAG = (0.5 * 1.225 * 0.47 * Math.PI * STONE_RADIUS ** 2) / STONE_MASS;
// The empty sling: a leather pouch and two cords, all air drag and no weight.
const POUCH_MASS = 0.6;
const POUCH_DRAG = 0.12; // ½·ρ·Cd·A, newtons per (m/s)²
// Wood on greased wood, and wood on wood.
const AXLE_DRAG = 420; // N·m per rad/s
const AXLE_GRIP = 450; // N·m of dry friction
const HINGE_DRAG = 300;
const TROUGH_FRICTION = 0.3;

type Vec = { z: number; y: number };

export type Throw = {
  /** θ, φ, ψ. */
  q: [number, number, number];
  /** Their rates. */
  w: [number, number, number];
  phase: "trough" | "sling" | "flight";
  /** The stone once it has left the sling. */
  stone: Vec & { vz: number; vy: number };
  /** The trough's push on the stone, newtons (stage 1). */
  push: number;
  t: number;
};

const hang = -Math.PI / 2;

/** Sling angle that keeps the stone in the trough for a given arm angle. */
function troughSling(theta: number) {
  const tipY = AXLE.y + LA * Math.sin(theta);
  return Math.asin(Math.max(-1, Math.min(1, (STONE_Y - tipY) / SL)));
}

/** Cocked and loaded: arm wound down at the back, stone ahead of the tip in its trough. */
export function cocked(): Throw {
  const psi = troughSling(COCK);
  const s: Throw = { q: [COCK, hang, psi], w: [0, 0, 0], phase: "trough", stone: { z: 0, y: 0, vz: 0, vy: 0 }, push: STONE_MASS * G, t: 0 };
  const p = points(s);
  s.stone.z = p.S.z;
  s.stone.y = p.S.y;
  return s;
}

/** Where everything is: arm tip, hinge, top and middle of the box, sling end, stone. */
export function points(s: Throw) {
  const [th, ph, ps] = s.q;
  const A = { z: AXLE.z + LA * Math.cos(th), y: AXLE.y + LA * Math.sin(th) };
  const B = { z: AXLE.z - LB * Math.cos(th), y: AXLE.y - LB * Math.sin(th) };
  const C = { z: B.z + HC * Math.cos(ph), y: B.y + HC * Math.sin(ph) };
  const S = { z: A.z + SL * Math.cos(ps), y: A.y + SL * Math.sin(ps) };
  const stone = s.phase === "flight" ? { z: s.stone.z, y: s.stone.y } : S;
  return { A, B, C, S, stone };
}

/** Velocity of the sling's end. */
function slingEndVelocity(q: number[], w: number[]): Vec {
  return {
    z: -LA * Math.sin(q[0]) * w[0] - SL * Math.sin(q[2]) * w[2],
    y: LA * Math.cos(q[0]) * w[0] + SL * Math.cos(q[2]) * w[2],
  };
}

/** Solve a small dense linear system in place (Gaussian elimination, partial pivoting). */
function solve(a: number[][], b: number[]) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    [a[i], a[p]] = [a[p], a[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / a[i][i];
      for (let c = i; c < n; c++) a[r][c] -= f * a[i][c];
      b[r] -= f * b[i];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let c = i + 1; c < n; c++) b[i] -= a[i][c] * b[c];
    b[i] /= a[i][i];
  }
  return b;
}

/**
 * Angular accelerations from Lagrange's equations.
 * `load` is the mass at the sling's end; `held` keeps it in the trough.
 */
function accelerate(q: number[], w: number[], load: number, held: boolean, pushWas: number) {
  // Each mass: a chain of links (length, which angle, offset to that angle).
  const bodies: { m: number; chain: [number, number, number][] }[] = [
    { m: ARM_MASS, chain: [[ARM_COM, 0, 0]] },
    { m: CW_MASS, chain: [[LB, 0, Math.PI], [CW_COM, 1, 0]] },
    { m: load, chain: [[LA, 0, 0], [SL, 2, 0]] },
  ];
  const M = [
    [ARM_I, 0, 0],
    [0, CW_I, 0],
    [0, 0, 0],
  ];
  const f = [0, 0, 0];
  for (const { m, chain } of bodies) {
    // Centripetal pull of every link, plus gravity.
    let cz = 0;
    let cy = -G;
    for (const [L, j, off] of chain) {
      cz += L * w[j] * w[j] * Math.cos(q[j] + off);
      cy += L * w[j] * w[j] * Math.sin(q[j] + off);
    }
    for (const [La, j, offA] of chain) {
      const a = q[j] + offA;
      f[j] += m * La * (-Math.sin(a) * cz + Math.cos(a) * cy);
      for (const [Lb, k, offB] of chain) M[j][k] += m * La * Lb * Math.cos(a - (q[k] + offB));
    }
  }
  // Friction at the axle and at the counterweight's hinge.
  f[0] += -AXLE_DRAG * w[0] - AXLE_GRIP * Math.tanh(w[0] / 0.05) + HINGE_DRAG * (w[1] - w[0]);
  f[1] += -HINGE_DRAG * (w[1] - w[0]);

  const v = slingEndVelocity(q, w);
  // How the sling end moves with θ and ψ.
  const Jz = [-LA * Math.sin(q[0]), 0, -SL * Math.sin(q[2])];
  const Jy = [LA * Math.cos(q[0]), 0, SL * Math.cos(q[2])];
  if (held) {
    // Sliding friction along the trough, from the push found last time.
    const drag = -TROUGH_FRICTION * Math.max(0, pushWas) * Math.tanh(v.z / 0.05);
    for (let j = 0; j < 3; j++) f[j] += Jz[j] * drag;
    // Fourth equation: the stone's height does not change.
    const a = [
      [M[0][0], M[0][1], M[0][2], -Jy[0]],
      [M[1][0], M[1][1], M[1][2], -Jy[1]],
      [M[2][0], M[2][1], M[2][2], -Jy[2]],
      [Jy[0], Jy[1], Jy[2], 0],
    ];
    const b = [f[0], f[1], f[2], LA * Math.sin(q[0]) * w[0] * w[0] + SL * Math.sin(q[2]) * w[2] * w[2]];
    const x = solve(a, b);
    return { acc: [x[0], x[1], x[2]], push: x[3] };
  }
  if (load === POUCH_MASS) {
    // The empty pouch is all air drag.
    const speed = Math.hypot(v.z, v.y);
    for (let j = 0; j < 3; j++) f[j] += -POUCH_DRAG * speed * (Jz[j] * v.z + Jy[j] * v.y);
  }
  return { acc: solve(M, f), push: 0 };
}

const H = 1 / 960;

/** One Runge–Kutta step of the machine. */
function advance(s: Throw, load: number, held: boolean) {
  const q0 = s.q;
  const w0 = s.w;
  const at = (q: number[], w: number[]) => accelerate(q, w, load, held, s.push);
  const k1 = at(q0, w0);
  const q1 = q0.map((v, i) => v + 0.5 * H * w0[i]);
  const w1 = w0.map((v, i) => v + 0.5 * H * k1.acc[i]);
  const k2 = at(q1, w1);
  const q2 = q0.map((v, i) => v + 0.5 * H * w1[i]);
  const w2 = w0.map((v, i) => v + 0.5 * H * k2.acc[i]);
  const k3 = at(q2, w2);
  const q3 = q0.map((v, i) => v + H * w2[i]);
  const w3 = w0.map((v, i) => v + H * k3.acc[i]);
  const k4 = at(q3, w3);
  for (let i = 0; i < 3; i++) {
    s.q[i] = q0[i] + (H / 6) * (w0[i] + 2 * w1[i] + 2 * w2[i] + w3[i]);
    s.w[i] = w0[i] + (H / 6) * (k1.acc[i] + 2 * k2.acc[i] + 2 * k3.acc[i] + k4.acc[i]);
  }
  s.push = k1.push;
}

/** Advance by `dt` seconds. Reports the moment the stone lifts and the moment it is let go. */
export function step(s: Throw, dt: number): "lift" | "release" | null {
  let event: "lift" | "release" | null = null;
  const n = Math.max(1, Math.round(dt / H));
  for (let i = 0; i < n; i++) {
    s.t += H;
    if (s.phase === "trough") {
      advance(s, STONE_MASS, true);
      // Keep the stone exactly on the wood (the integrator drifts by microns).
      s.q[2] = troughSling(s.q[0]);
      s.w[2] = (-LA * Math.cos(s.q[0]) * s.w[0]) / (SL * Math.cos(s.q[2]));
      if (s.push <= 0) {
        s.phase = "sling";
        event = "lift";
      }
    } else if (s.phase === "sling") {
      advance(s, STONE_MASS, false);
      const v = slingEndVelocity(s.q, s.w);
      // The loop slips off the prong: the stone is over the top, climbing and
      // going downrange, and its path has flattened to the set angle.
      if (v.z > 0 && v.y > 0 && Math.atan2(v.y, v.z) <= RELEASE && AXLE.y + LA * Math.sin(s.q[0]) + SL * Math.sin(s.q[2]) > AXLE.y) {
        const p = points(s);
        s.stone = { z: p.S.z, y: p.S.y, vz: v.z, vy: v.y };
        s.phase = "flight";
        event = "release";
      }
    } else {
      advance(s, POUCH_MASS, false);
      // The stone, on its own: gravity and air drag (midpoint rule).
      const b = s.stone;
      const drag = (vz: number, vy: number) => {
        const k = STONE_DRAG * Math.hypot(vz, vy);
        return { az: -k * vz, ay: -G - k * vy };
      };
      const a1 = drag(b.vz, b.vy);
      const mz = b.vz + 0.5 * H * a1.az;
      const my = b.vy + 0.5 * H * a1.ay;
      const a2 = drag(mz, my);
      b.z += H * mz;
      b.y += H * my;
      b.vz += H * a2.az;
      b.vy += H * a2.ay;
    }
  }
  return event;
}

/** Total mechanical energy, for checking the integration (joules). */
export function energy(s: Throw) {
  const [th, ph, ps] = s.q;
  const [wt, wp] = s.w;
  const load = s.phase === "flight" ? POUCH_MASS : STONE_MASS;
  const arm = 0.5 * (ARM_I + ARM_MASS * ARM_COM ** 2) * wt * wt + ARM_MASS * G * (AXLE.y + ARM_COM * Math.sin(th));
  const cvz = LB * Math.sin(th) * wt - CW_COM * Math.sin(ph) * wp;
  const cvy = -LB * Math.cos(th) * wt + CW_COM * Math.cos(ph) * wp;
  const cw = 0.5 * CW_MASS * (cvz * cvz + cvy * cvy) + 0.5 * CW_I * wp * wp + CW_MASS * G * (AXLE.y - LB * Math.sin(th) + CW_COM * Math.sin(ph));
  const v = slingEndVelocity(s.q, s.w);
  const end = 0.5 * load * (v.z * v.z + v.y * v.y) + load * G * (AXLE.y + LA * Math.sin(th) + SL * Math.sin(ps));
  const b = s.stone;
  const ball = s.phase === "flight" ? 0.5 * STONE_MASS * (b.vz * b.vz + b.vy * b.vy) + STONE_MASS * G * b.y : 0;
  return arm + cw + end + ball;
}
