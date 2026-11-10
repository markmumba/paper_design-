"use client";

import { useEffect, useState, type RefObject } from "react";

const R = 96;
const LEVELS = [3.5, 8];

/**
 * A magnifying glass that follows the pointer over a drawing. It re-renders the
 * live drawing through <use>, so animation keeps running inside the lens.
 * Click to switch between the two magnifications.
 */
export function Loupe({ svgRef, target, id }: { svgRef: RefObject<SVGSVGElement | null>; target: string; id: string }) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      setPt({ x: p.x, y: p.y });
    };
    const leave = () => setPt(null);
    const click = () => setLevel((l) => (l + 1) % LEVELS.length);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", leave);
    svg.addEventListener("click", click);
    svg.style.cursor = "none";
    return () => {
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerleave", leave);
      svg.removeEventListener("click", click);
    };
  }, [svgRef]);

  if (!pt) return null;
  const zoom = LEVELS[level];
  const { x, y } = pt;

  return (
    <g pointerEvents="none" aria-hidden data-no-snap>
      <defs>
        <clipPath id={`lens-${id}`}>
          <circle cx={x} cy={y} r={R} />
        </clipPath>
        <radialGradient id={`glass-${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff8e6" stopOpacity={0.35} />
          <stop offset="55%" stopColor="#fff8e6" stopOpacity={0} />
          <stop offset="100%" stopColor="#5a3a1a" stopOpacity={0.22} />
        </radialGradient>
      </defs>

      {/* Drop shadow of the lens on the page. */}
      <circle cx={x + 5} cy={y + 7} r={R + 5} fill="#3a2717" opacity={0.12} />

      <g clipPath={`url(#lens-${id})`}>
        <circle cx={x} cy={y} r={R} style={{ fill: "var(--color-paper)" }} />
        <use href={`#${target}`} transform={`translate(${x} ${y}) scale(${zoom}) translate(${-x} ${-y})`} />
        <circle cx={x} cy={y} r={R} fill={`url(#glass-${id})`} />
      </g>

      <g className="text-ink" fill="none" stroke="currentColor">
        <circle cx={x} cy={y} r={R} strokeWidth={3} />
        <circle cx={x} cy={y} r={R + 5} strokeWidth={0.8} />
        <circle cx={x} cy={y} r={R - 3} strokeWidth={0.4} opacity={0.6} />
        <path d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} strokeWidth={0.6} opacity={0.5} />
        {/* Handle */}
        <path
          d={`M${x + R * 0.72} ${y + R * 0.72}l30 30M${x + R * 0.72 + 6} ${y + R * 0.72 - 3}l30 30M${x + R * 0.72 - 3} ${y + R * 0.72 + 6}l30 30`}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </g>
      <text
        x={x}
        y={y + R + 18}
        textAnchor="middle"
        className="fill-rust"
        style={{ fontFamily: "var(--font-fell)", fontStyle: "italic", fontSize: 11 }}
      >
        ×{zoom} · click to {level === 0 ? "look closer" : "pull back"}
      </text>
    </g>
  );
}
