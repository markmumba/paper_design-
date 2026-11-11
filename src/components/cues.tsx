"use client";

import { useMotionValueEvent, type MotionValue } from "motion/react";
import { createContext, useContext, useRef } from "react";

/*
 * Sound cues for things the scroll drives.
 *
 * A scroll-driven drawing has no clock of its own: its only time is the
 * progress value, which can run forwards, backwards, slowly or in one jump.
 * So a cue is never a timer. It is a place on that progress (the bolt leaves
 * at 0.7) or a step of the moving part itself (each tooth of the winch), and
 * it fires on the frame the progress passes it, at most once per frame.
 */

/** Whether the folio a drawing belongs to is the one pinned on screen and showing its drawing. */
export const FolioLive = createContext<() => boolean>(() => true);

/**
 * Calls `fn` each frame the progress moves while its folio is live, with the
 * new value, the last one, and how fast it is moving (progress per second).
 */
export function useCues(p: MotionValue<number>, fn: (v: number, was: number, speed: number) => void) {
  const live = useContext(FolioLive);
  const last = useRef<{ v: number; t: number } | null>(null);
  useMotionValueEvent(p, "change", (v) => {
    const now = performance.now();
    const prev = last.current ?? { v, t: now - 16 };
    last.current = { v, t: now };
    if (v === prev.v || !live()) return;
    fn(v, prev.v, Math.abs(v - prev.v) / Math.max(0.004, (now - prev.t) / 1000));
  });
}

/** The progress has just passed `at` going forwards. */
export const rose = (was: number, v: number, at: number) => was < at && v >= at;
/** The progress has just passed `at` going backwards. */
export const fell = (was: number, v: number, at: number) => was >= at && v < at;
/** `a` has moved into another step of width `size` (a tooth, a half-turn, a beat), in either direction. */
export const stepped = (was: number, a: number, size: number, offset = 0) => Math.floor((a - offset) / size) !== Math.floor((was - offset) / size);
