/*
 * Procedural foley for the museum, synthesised live with the Web Audio API.
 * No audio files: every sound is shaped noise, so each one comes out a little
 * different, the way real paper and real wings never sound the same twice.
 *
 *  - strike():   a match scratched alight, the flare catching, a few crackles
 *  - pageFlip(): a sheet of heavy paper turned: rustle swell, crisp edge, settle
 *  - flap(k):    a canvas wing beating air: a low whoosh with fabric flutter
 *  - crackle():  the odd pop of a candle wick, for the hero's ambience
 *  - tick / creak / whoosh / scrape / scratch / stroke / stamp: the small
 *    voices of wood, rope, air and pen that the machines and folios make
 *
 * Every voice is a one-shot fired at the frame its event happens, so a cue is
 * only ever as late as the audio clock's few milliseconds of look-ahead.
 * Each has a shortest gap, so one event can never sound twice, and nothing
 * plays while the tab is hidden. hush() cuts whatever is still ringing when a
 * scene is left.
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
  private out: GainNode | null = null;
  private wet: GainNode | null = null;
  private last = new Map<string, number>();
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
      // Cut what is sounding first: a suspended context would otherwise play
      // the rest of it when sound is next switched on.
      this.hush(true);
      await this.ctx?.suspend();
    }
    this.listeners.forEach((l) => l());
  }

  /**
   * A remembered "on" still needs a gesture before audio may start. Resolves
   * true once the context is really running (the browser may still refuse).
   */
  async unlock() {
    if (!this.enabled) return false;
    this.ensure();
    try {
      await this.ctx?.resume();
    } catch {
      /* not a gesture the browser accepts: try again on the next one */
    }
    return this.ctx?.state === "running";
  }

  /**
   * Silence everything still ringing (a boom's tail, a creak) when its scene
   * is closed or left. Sounds already scheduled play out unheard on the old
   * bus; anything fired afterwards goes to a fresh one.
   */
  hush(hard = false) {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.wet || !this.room || !this.master) return;
    const out = this.out;
    const wet = this.wet;
    const room = this.room;
    const drop = () => {
      out.disconnect();
      wet.disconnect();
      room.disconnect();
    };
    if (hard) drop();
    else {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      wet.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      window.setTimeout(drop, 500);
    }
    this.out = ctx.createGain();
    this.out.connect(this.master);
    this.room = ctx.createConvolver();
    this.room.buffer = room.buffer;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.22;
    this.room.connect(this.wet).connect(this.master);
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
    // Voices play into `out`, a bus that hush() can swap for a silent new one.
    const out = ctx.createGain();
    out.connect(master);
    this.ctx = ctx;
    this.master = master;
    this.out = out;
    this.wet = wet;
    this.room = room;
    this.noise = noise;
  }

  private ready() {
    return this.enabled && this.ctx && this.ctx.state === "running" && !document.hidden ? this.ctx : null;
  }

  /**
   * Gate for every voice: drops a cue that comes within `gap` ms of the same
   * voice's last one, then says whether audio can play at all. When
   * `window.__cues` is an array, each cue that passes is logged there with its
   * time, so cue timing can be checked against the animation without ears.
   */
  private cue(name: string, gap: number) {
    if (typeof window === "undefined") return null;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < gap) return null;
    this.last.set(name, now);
    const log = (window as unknown as { __cues?: { name: string; t: number }[] }).__cues;
    if (log) log.push({ name, t: now });
    return this.ready();
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
    pan.connect(this.out!);
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
  strike(delay = 0) {
    const ctx = this.cue("strike", 1200);
    if (!ctx) return;
    const t = ctx.currentTime + 0.02 + delay;
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
    o.connect(og).connect(this.out!);
    o.start(t + 0.2);
    o.stop(t + 1);
    for (let i = 0; i < 6; i++) this.click(t + 0.35 + Math.random() * 1.2, 0.05 + Math.random() * 0.12, Math.random() * 0.6 - 0.3);
  }

  /** A small wooden knock: choosing a part of the machine. */
  knock() {
    const ctx = this.cue("knock", 40);
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.09, type: "bandpass", freq: [880 + Math.random() * 120, 520], q: 6, gain: 0.22, attack: 0.002, wet: 0.35 });
    this.burst({ at: t, dur: 0.03, type: "highpass", freq: [3000, 2000], gain: 0.05, attack: 0.001, wet: 0.2 });
  }

  /** The machine coming apart or together: a clatter of cane and wood. */
  clatter() {
    const ctx = this.cue("clatter", 200);
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
    const ctx = this.cue("boom", 90);
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
    o.connect(og).connect(this.out!);
    o.start(t);
    o.stop(t + 0.85);
    for (let i = 0; i < 4; i++) this.click(t + 0.15 + Math.random() * 0.5, 0.05, Math.random() - 0.5);
  }

  /** A great bow loosed: the string's thwack and a fading hum. */
  twang(k = 1) {
    const ctx = this.cue("twang", 120);
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
    o.connect(lp).connect(og).connect(this.out!);
    o.start(t);
    o.stop(t + 0.75);
    this.burst({ at: t + 0.02, dur: 0.5, type: "bandpass", freq: [2400, 900], q: 0.8, gain: 0.1 * k, attack: 0.02, wet: 0.2 });
  }

  /** A heavy thud of something landing (stone on stone, bolt in wood). */
  thud(k = 1) {
    const ctx = this.cue("thud", 60);
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.35, type: "lowpass", freq: [500, 80], q: 0.8, gain: 0.45 * k, attack: 0.003, wet: 0.5 });
    for (let i = 0; i < 5; i++) this.click(t + 0.02 + Math.random() * 0.3, 0.06 * k, Math.random() - 0.5);
  }

  /** A ratchet pawl dropping, a cog's tooth meeting the next: one small wooden tick. */
  tick(k = 1, pitch = 1, delay = 0) {
    const ctx = this.cue(pitch < 0.7 ? "tick-low" : "tick", 45);
    if (!ctx) return;
    const t = ctx.currentTime + 0.005 + delay;
    const f = (1500 + Math.random() * 300) * pitch;
    this.burst({ at: t, dur: 0.035, type: "bandpass", freq: [f, f * 0.72], q: 7, gain: 0.1 * k, attack: 0.001, pan: Math.random() * 0.3 - 0.15, wet: 0.25 });
    this.burst({ at: t, dur: 0.012, type: "highpass", freq: [3400, 2400], gain: 0.025 * k, attack: 0.001, wet: 0.15 });
  }

  /** Timber under load: a beam, an axle or a hinge groaning as the weight comes onto it. */
  creak(k = 1) {
    const ctx = this.cue("creak", 180);
    if (!ctx) return;
    const s = Math.max(0.2, Math.min(1, k));
    const t = ctx.currentTime + 0.005;
    const dur = 0.28 + 0.3 * s;
    // Stick-slip: a slow sawtooth through a narrow band, rising as the wood gives.
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f0 = 62 + Math.random() * 30;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (1.25 + 0.4 * Math.random()), t + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 7;
    bp.frequency.setValueAtTime(520 + Math.random() * 160, t);
    bp.frequency.linearRampToValueAtTime(820 + Math.random() * 200, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.16 * s, t + dur * 0.35);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(og).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.burst({ at: t, dur, type: "bandpass", freq: [560, 700], q: 9, gain: 0.05 * s, attack: dur * 0.3, wet: 0.3 });
  }

  /** Air parting round something moving fast: a sling, an arm, a fall. `k` is how fast. */
  whoosh(k = 1, dur = 0.5) {
    const ctx = this.cue("whoosh", 140);
    if (!ctx) return;
    const s = Math.max(0.1, Math.min(1, k));
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur, type: "bandpass", freq: [320 + 200 * s, 900 + 1100 * s], q: 0.9, gain: 0.08 + 0.22 * s, attack: dur * 0.55, pan: Math.random() * 0.4 - 0.2, wet: 0.3 });
    this.burst({ at: t, dur: dur * 0.9, type: "lowpass", freq: [180, 420 + 300 * s], q: 0.7, gain: 0.05 + 0.1 * s, attack: dur * 0.5, wet: 0.2 });
  }

  /** Stone dragged over wood: a short grind, meant to be repeated while the dragging lasts. */
  scrape(k = 1) {
    const ctx = this.cue("scrape", 70);
    if (!ctx) return;
    const s = Math.max(0.1, Math.min(1, k));
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.15, type: "bandpass", freq: [420 + 380 * s, 360], q: 1.2, gain: 0.06 + 0.13 * s, attack: 0.03, flutter: 34 + 20 * s, wet: 0.3 });
  }

  /** One short stroke of a quill on rag paper. `k` is how hard the pen is working. */
  scratch(k = 1) {
    const ctx = this.cue("scratch", 55);
    if (!ctx) return;
    const s = Math.max(0.25, Math.min(1, k));
    const t = ctx.currentTime + 0.005;
    const f = 2500 + Math.random() * 1300;
    this.burst({ at: t, dur: 0.05 + Math.random() * 0.07, type: "bandpass", freq: [f, f * (0.7 + Math.random() * 0.5)], q: 2.4, gain: (0.035 + Math.random() * 0.03) * s, attack: 0.01, pan: Math.random() * 0.4 - 0.2, wet: 0.1 });
  }

  /** A long ruled line drawn in one pull of the pen, `dur` seconds long, starting after `delay`. */
  stroke(dur: number, delay = 0) {
    const ctx = this.cue("stroke", 0);
    if (!ctx) return;
    const t = ctx.currentTime + 0.01 + delay;
    this.burst({ at: t, dur, type: "bandpass", freq: [2300 + Math.random() * 500, 3100], q: 1.8, gain: 0.05, attack: dur * 0.3, flutter: 31, pan: Math.random() * 0.3 - 0.15, wet: 0.1 });
  }

  /** A run of `n` dabs of the pen (points marked on a sheet), `every` seconds apart, after `delay`. */
  dabs(n: number, delay = 0, every = 0.08) {
    const ctx = this.cue("dabs", 0);
    if (!ctx) return;
    const t = ctx.currentTime + 0.01 + delay;
    for (let i = 0; i < n; i++) {
      this.burst({ at: t + i * every, dur: 0.05, type: "bandpass", freq: [1300 + Math.random() * 300, 800], q: 4, gain: 0.07, attack: 0.002, pan: Math.random() * 0.3 - 0.15, wet: 0.2 });
    }
  }

  /** A drop of ink landing on the desk: a small wet pat, and the spatter round it. */
  drip() {
    const ctx = this.cue("drip", 60);
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const pan = Math.random() * 0.4 - 0.2;
    this.burst({ at: t, dur: 0.11, type: "lowpass", freq: [700, 160], q: 1.4, gain: 0.26, attack: 0.002, pan, wet: 0.25 });
    for (let i = 0; i < 4; i++) this.click(t + 0.015 + Math.random() * 0.09, 0.03 + Math.random() * 0.04, pan + Math.random() * 0.4 - 0.2);
  }

  /** A rubber stamp coming down on the page: the verdict. */
  stamp() {
    const ctx = this.cue("stamp", 400);
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.burst({ at: t, dur: 0.16, type: "lowpass", freq: [320, 90], q: 0.8, gain: 0.34, attack: 0.002, wet: 0.3 });
    this.burst({ at: t, dur: 0.05, type: "bandpass", freq: [1800, 1200], q: 1.5, gain: 0.05, attack: 0.001, wet: 0.2 });
  }

  /** An occasional pop from the wick. */
  crackle() {
    const ctx = this.cue("crackle", 200);
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.click(t + i * (0.03 + Math.random() * 0.08), 0.04 + Math.random() * 0.08, Math.random() * 0.8 - 0.4);
  }

  /** Turning a heavy sheet of rag paper. */
  pageFlip() {
    const ctx = this.cue("pageFlip", 500);
    if (!ctx) return;
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
    const ctx = this.cue("flap", 120);
    if (!ctx) return;
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
