import * as THREE from "three";

/*
 * A small flight model for the ornithopter, so its motion follows physics
 * rather than a scripted circle:
 *
 *  - Asymmetric wingbeat: a quick power downstroke (38% of the cycle) and a
 *    slower recovery upstroke, the rhythm of a large bird.
 *  - Lift = gliding lift from forward speed + a pulse from each downstroke,
 *    against gravity. The body heaves up on the downstroke and sinks on the
 *    recovery, which is what makes flapping flight look alive.
 *  - Thrust pulses with the downstroke against quadratic drag, so airspeed
 *    surges and eases with every beat.
 *  - The pilot holds altitude by flapping harder or easier (a PD controller).
 *  - Turns are coordinated: bank angle = atan(speed × turn rate / g), so tight
 *    or fast turns lean further, as any flying thing must.
 *  - Pitch follows the flight path (nose up while climbing).
 *  - The course wanders gently and curls back towards the middle of the sea.
 */

const G = 9.81;
const FREQ = 0.8; // wingbeats per second
const DOWN = 0.38; // fraction of the beat spent on the power stroke
const UP_ANGLE = 0.5;
const DOWN_ANGLE = -0.32;
const LIFT_GLIDE = 0.1; // × v²
const LIFT_BEAT = 5.3; // × downstroke angular speed
const THRUST_BEAT = 2.0;
const DRAG = 0.02; // × v²

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

export function wingAngle(phase: number) {
  return phase < DOWN
    ? UP_ANGLE + (DOWN_ANGLE - UP_ANGLE) * ease(phase / DOWN)
    : DOWN_ANGLE + (UP_ANGLE - DOWN_ANGLE) * ease((phase - DOWN) / (1 - DOWN));
}

export type Flight = {
  pos: THREE.Vector3;
  yaw: number;
  yawRate: number;
  speed: number;
  vy: number;
  phase: number;
  angle: number;
  bank: number;
  pitch: number;
  t: number;
};

export function createFlight(): Flight {
  return { pos: new THREE.Vector3(18, 7, 0), yaw: 0, yawRate: 0, speed: 8, vy: 0, phase: 0.6, angle: wingAngle(0.6), bank: 0, pitch: 0, t: 0 };
}

/** Advance the flight by dt seconds. Returns true at the start of each downstroke. */
export function stepFlight(f: Flight, dtIn: number): boolean {
  const dt = Math.min(dtIn, 1 / 30);
  f.t += dt;
  const prevPhase = f.phase;
  f.phase = (f.phase + dt * FREQ) % 1;
  const stroke = f.phase < prevPhase; // wrapped: a new downstroke begins
  const prevAngle = f.angle;
  f.angle = wingAngle(f.phase);
  const omega = (f.angle - prevAngle) / Math.max(dt, 1e-4);
  const power = Math.max(0, -omega); // only the downstroke pushes air down and back

  // The pilot works harder when below the cruising height or sinking.
  const targetAlt = 7 + Math.sin(f.t * 0.09) * 1.5;
  const effort = Math.min(1.6, Math.max(0.55, 1 + 0.16 * (targetAlt - f.pos.y) - 0.28 * f.vy));

  const lift = LIFT_GLIDE * f.speed * f.speed + LIFT_BEAT * power * effort;
  f.vy += (lift - G) * dt;
  f.vy *= 1 - 0.6 * dt; // vertical damping from the wing area
  f.speed += (THRUST_BEAT * power * effort - DRAG * f.speed * f.speed) * dt;
  f.speed = Math.max(4, Math.min(12, f.speed));

  // Course: a lazy wander, curling back once it strays from the middle.
  let turn = 0.16 * Math.sin(f.t * 0.13) + 0.08 * Math.sin(f.t * 0.31 + 1.7);
  const dist = Math.hypot(f.pos.x, f.pos.z);
  if (dist > 22) {
    const toCentre = Math.atan2(-f.pos.x, -f.pos.z);
    let diff = toCentre - f.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    turn += Math.max(-0.45, Math.min(0.45, diff * 0.6)) * Math.min(1, (dist - 22) / 8);
  }
  f.yawRate += (turn - f.yawRate) * Math.min(1, dt * 1.6);
  f.yaw += f.yawRate * dt;

  // Coordinated turn: lean into it. +yaw turns towards the +X (left) wing,
  // and dipping that wing is a negative roll.
  const bankTarget = -Math.atan((f.speed * f.yawRate) / G);
  f.bank += (bankTarget - f.bank) * Math.min(1, dt * 2.5);
  const pitchTarget = -Math.atan2(f.vy, f.speed) * 0.85 + 0.05 + (power > 0 ? -0.03 : 0.02);
  f.pitch += (pitchTarget - f.pitch) * Math.min(1, dt * 4);

  f.pos.x += Math.sin(f.yaw) * f.speed * dt;
  f.pos.z += Math.cos(f.yaw) * f.speed * dt;
  f.pos.y += f.vy * dt;
  f.pos.y = Math.max(2.5, f.pos.y);
  return stroke;
}
