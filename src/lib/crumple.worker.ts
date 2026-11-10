import { simulate } from "./crumpleSim";

// Runs the paper simulation off the main thread so scrolling never stutters.
self.onmessage = (e: MessageEvent<{ aspect: number; seed: number }>) => {
  const r = simulate(e.data.aspect, e.data.seed);
  (self as unknown as Worker).postMessage(r, [r.frames.buffer, r.uv.buffer, r.index.buffer, r.radius.buffer, r.centerZ.buffer]);
};
