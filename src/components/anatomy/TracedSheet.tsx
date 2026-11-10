"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useId } from "react";
import { Ink } from "@/components/ink";

/*
 * Leonardo's own ink, revealed as if his pen were drawing it.
 *
 * Each sheet was prepared offline from the public-domain scan: the ink was
 * lifted off the paper into a transparent image, and the drawing's lines
 * were traced into pen paths, ordered the way a hand would move from one
 * stroke to the next. Here those paths are drawn into a mask as you scroll,
 * so his ink appears stroke by stroke; once the pen is done, the full sheet
 * settles in to fill whatever the paths missed.
 */

export type Traced = {
  parts: { href: string; x: number; y: number; w: number; h: number }[];
  chunks: { d: string; w: number }[][];
};

export function TracedSheet({ data, p, from, to }: { data: Traced; p: MotionValue<number>; from: number; to: number }) {
  const id = useId().replace(/:/g, "");
  const n = data.chunks.length;
  const span = to - from;
  const settle = useTransform(p, [to - span * 0.08, to + span * 0.12], [0, 1]);
  return (
    <>
      <defs>
        <mask id={`pen-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={600} height={480}>
          <g style={{ color: "#fff" }}>
            {data.chunks.map((chunk, i) => {
              const a = from + (span * i) / n;
              const b = a + (span * 1.6) / n;
              return chunk.map((s, j) => <Ink key={`${i}-${j}`} d={s.d} p={p} from={a} to={b} w={s.w} />);
            })}
          </g>
        </mask>
      </defs>
      <g mask={`url(#pen-${id})`}>
        {data.parts.map((pt) => (
          <image key={pt.href} href={pt.href} x={pt.x} y={pt.y} width={pt.w} height={pt.h} preserveAspectRatio="none" />
        ))}
      </g>
      <motion.g style={{ opacity: settle }}>
        {data.parts.map((pt) => (
          <image key={pt.href} href={pt.href} x={pt.x} y={pt.y} width={pt.w} height={pt.h} preserveAspectRatio="none" />
        ))}
      </motion.g>
    </>
  );
}
