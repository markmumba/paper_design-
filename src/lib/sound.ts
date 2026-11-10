/*
 * Procedural foley for the museum, synthesised live with the Web Audio API.
 * No audio files: every sound is shaped noise, so each one comes out a little
 * different, the way real paper and real wings never sound the same twice.
 *
 *  - strike():   a match scratched alight, the flare catching, a few crackles
 *  - pageFlip(): a sheet of heavy paper turned: rustle swell, crisp edge, settle
 *  - flap(k):    a canvas wing beating air: a low whoosh with fabric flutter
 *  - crackle():  the odd pop of a candle wick, for the hero's ambience
 *
 * Browsers only allow audio after a user gesture, so sound starts off and is
 * switched on with the toggle; the choice is remembered on this device.
 */

type Listener = () => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private room: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  private lastFlip = 0;
  private lastFlap = 0;
  enabled = false;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.enabled = window.localStorage.getItem("codex-sound") === "on";
    } catch {
      this.enabled = false;
    }
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.enabled;
  getServerSnapshot = () => false;

  /** Must be called from a user gesture (click / key). */
  async setEnabled(on: boolean) {
    this.enabled = on;
    try {
      window.localStorage.setItem("codex-sound", on ? "on" : "off");
    } catch {
      /* storage blocked: the choice just won't be remembered */
    }
    if (on) {
      this.ensure();
      await this.ctx?.resume();
    } else {
      await this.ctx?.suspend();
    }
    this.listeners.forEach((l) => l());
  }

  /** A remembered "on" still needs a gesture before audio may start. */
  unlock() {
    if (!this.enabled) return;
    this.ensure();
    void this.ctx?.resume();
  }

  private ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.7;
    // A small stone room: a short, dark, generated impulse response.
    const room = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.5;
    }
    room.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    room.connect(wet).connect(master);
    master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    this.master = master;
    this.room = room;
    this.noise = noise;
  }

  private ready() {
    return this.enabled && this.ctx && this.ctx.state === "running" ? this.ctx : null;
  }

  /** A burst of filtered noise with an envelope, routed dry + into the room. */
  private burst(opts: {
    at: number;
    dur: number;
    type: BiquadFilterType;
    freq: [number, number];
    q?: number;
    gain: number;
    attack: number;
    pan?: number;
    wet?: number;
    flutter?: number;
  }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.Q.value = opts.q ?? 1;
    f.frequency.setValueAtTime(opts.freq[0], opts.at);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freq[1]), opts.at + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, opts.at);
    g.gain.exponentialRampToValueAtTime(opts.gain, opts.at + opts.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
    let node: AudioNode = src;
    node.connect(f);
    node = f;
    if (opts.flutter) {
      // Fabric flutter: amplitude-modulate the noise at a few tens of hertz.
      const am = ctx.createGain();
      am.gain.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = opts.flutter;
      const depth = ctx.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(am.gain);
      lfo.start(opts.at);
      lfo.stop(opts.at + opts.dur + 0.05);
      node.connect(am);
      node = am;
    }
    node.connect(g);
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    g.connect(pan);
    pan.connect(this.master!);
    if (opts.wet) {
      const send = ctx.createGain();
      send.gain.value = opts.wet;
      pan.connect(send).connect(this.room!);
    }
    src.start(opts.at, Math.random() * 1.5);
    src.stop(opts.at + opts.dur + 0.05);
  }

  private click(at: number, gain: number, pan = 0) {
    this.burst({ at, dur: 0.012 + Math.random() * 0.02, type: "highpass", freq: [2500, 1800], gain, attack: 0.001, pan, wet: 0.5 });
  }

  /** The candle: match scratch, the flare catching, then the flame settling with a few pops. */
  strike() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    // Scratch: two rough strokes of the match head on the striker.
    for (let i = 0; i < 2; i++) {
      this.burst({ at: t + i * 0.11, dur: 0.09, type: "bandpass", freq: [3200, 2200], q: 1.4, gain: 0.32, attack: 0.004, wet: 0.2 });
    }
    // Flare: the phosphorus catches with a rush that opens up and dies back.
    this.burst({ at: t + 0.2, dur: 0.75, type: "lowpass", freq: [500, 2600], q: 0.7, gain: 0.42, attack: 0.03, wet: 0.35 });
    this.burst({ at: t + 0.32, dur: 1.4, type: "lowpass", freq: [1400, 260], q: 0.5, gain: 0.16, attack: 0.2, wet: 0.4 });
    // A soft low "whump" of air feeding the new flame.
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(95, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.8);
    og.gain.setValueAtTime(0.0001, t + 0.2);
    og.gain.exponentialRampToValueAtTime(0.22, t + 0.26);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(og).connect(this.master!);
    o.start(t + 0.2);
    o.stop(t + 1);
    for (let i = 0; i < 6; i++) this.click(t + 0.35 + Math.random() * 1.2, 0.05 + Math.random() * 0.12, Math.random() * 0.6 - 0.3);
  }

  /** A small wooden knock: choosing a part of the machine. */
  knock() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.09, type: "bandpass", freq: [880 + Math.random() * 120, 520], q: 6, gain: 0.22, attack: 0.002, wet: 0.35 });
    this.burst({ at: t, dur: 0.03, type: "highpass", freq: [3000, 2000], gain: 0.05, attack: 0.001, wet: 0.2 });
  }

  /** The machine coming apart or together: a clatter of cane and wood. */
  clatter() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    for (let i = 0; i < 7; i++) {
      const at = t + i * (0.035 + Math.random() * 0.05);
      this.burst({ at, dur: 0.07, type: "bandpass", freq: [600 + Math.random() * 700, 400], q: 5, gain: 0.12 + Math.random() * 0.1, attack: 0.002, pan: Math.random() * 0.8 - 0.4, wet: 0.35 });
    }
    this.burst({ at: t, dur: 0.5, type: "bandpass", freq: [1200, 2400], q: 0.8, gain: 0.08, attack: 0.08, wet: 0.3 });
  }

  /** A bombard firing: a sharp crack, a low boom rolling round the room, and debris. */
  boom(k = 1) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.12, type: "highpass", freq: [1800, 900], gain: 0.4 * k, attack: 0.001, wet: 0.5 });
    this.burst({ at: t, dur: 1.4, type: "lowpass", freq: [900, 90], q: 0.6, gain: 0.55 * k, attack: 0.004, wet: 0.7 });
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + 0.85);
    for (let i = 0; i < 4; i++) this.click(t + 0.15 + Math.random() * 0.5, 0.05, Math.random() - 0.5);
  }

  /** A great bow loosed: the string's thwack and a fading hum. */
  twang(k = 1) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.08, type: "bandpass", freq: [700, 300], q: 2, gain: 0.5 * k, attack: 0.001, wet: 0.4 });
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.18 * k, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(lp).connect(og).connect(this.master!);
    o.start(t);
    o.stop(t + 0.75);
    this.burst({ at: t + 0.02, dur: 0.5, type: "bandpass", freq: [2400, 900], q: 0.8, gain: 0.1 * k, attack: 0.02, wet: 0.2 });
  }

  /** A heavy thud of something landing (stone on stone, bolt in wood). */
  thud(k = 1) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.35, type: "lowpass", freq: [500, 80], q: 0.8, gain: 0.45 * k, attack: 0.003, wet: 0.5 });
    for (let i = 0; i < 5; i++) this.click(t + 0.02 + Math.random() * 0.3, 0.06 * k, Math.random() - 0.5);
  }

  /** An occasional pop from the wick. */
  crackle() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.click(t + i * (0.03 + Math.random() * 0.08), 0.04 + Math.random() * 0.08, Math.random() * 0.8 - 0.4);
  }

  /** Turning a heavy sheet of rag paper. */
  pageFlip() {
    const ctx = this.ready();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastFlip < 500) return;
    this.lastFlip = now;
    const t = ctx.currentTime + 0.01;
    const pan = Math.random() * 0.5 - 0.25;
    // Rustle: the sheet lifting, a broad swell of mid-range noise.
    this.burst({ at: t, dur: 0.42, type: "bandpass", freq: [900, 2600], q: 0.8, gain: 0.3, attack: 0.12, pan, wet: 0.3 });
    // The crisp edge sliding over the stack.
    this.burst({ at: t + 0.1, dur: 0.26, type: "highpass", freq: [4200, 6500], q: 0.7, gain: 0.12, attack: 0.05, pan: pan * 1.6, wet: 0.2 });
    // Fibres crackling as the sheet bends.
    for (let i = 0; i < 5; i++) this.click(t + 0.08 + Math.random() * 0.3, 0.025 + Math.random() * 0.04, pan);
    // It settles: a soft, low pat of paper landing on paper.
    this.burst({ at: t + 0.38, dur: 0.12, type: "lowpass", freq: [420, 180], q: 0.7, gain: 0.28, attack: 0.006, pan, wet: 0.25 });
  }

  /** One wingbeat. `k` (0..1) is how hard the wing is driven. */
  flap(k: number) {
    const ctx = this.ready();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastFlap < 120) return;
    this.lastFlap = now;
    const t = ctx.currentTime + 0.005;
    const s = Math.max(0.15, Math.min(1, k));
    const pan = Math.random() * 0.3 - 0.15;
    // The downstroke: a big low whoosh of displaced air.
    this.burst({ at: t, dur: 0.22 + 0.12 * s, type: "lowpass", freq: [260 + 500 * s, 140], q: 0.9, gain: 0.18 + 0.32 * s, attack: 0.025, pan, wet: 0.25 });
    // Canvas snapping taut, with flutter in the stretched membrane.
    this.burst({ at: t + 0.015, dur: 0.18, type: "bandpass", freq: [1500, 900], q: 1.2, gain: 0.05 + 0.1 * s, attack: 0.01, pan: -pan, flutter: 26 + 18 * s, wet: 0.15 });
    // Creak of the cane frame under load.
    if (Math.random() < 0.35) this.burst({ at: t + 0.05, dur: 0.07, type: "bandpass", freq: [620, 540], q: 9, gain: 0.04 * s, attack: 0.01, wet: 0.3 });
  }
}

export const sound = new SoundEngine();
