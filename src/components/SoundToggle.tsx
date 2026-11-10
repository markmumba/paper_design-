"use client";

import { useEffect, useSyncExternalStore } from "react";
import { sound } from "@/lib/sound";

/**
 * Sound on/off, drawn as an ink horn with sound lines. Off by default; a
 * remembered "on" resumes on the visitor's first click or key press, since
 * browsers block audio until then.
 */
export function SoundToggle({ onEnable }: { onEnable?: () => void }) {
  const on = useSyncExternalStore(sound.subscribe, sound.getSnapshot, sound.getServerSnapshot);

  useEffect(() => {
    const first = () => {
      if (sound.enabled) {
        sound.unlock();
        window.setTimeout(() => onEnable?.(), 60);
      }
    };
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => {
      window.removeEventListener("pointerdown", first);
      window.removeEventListener("keydown", first);
    };
  }, [onEnable]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      onClick={async (e) => {
        e.stopPropagation();
        await sound.setEnabled(!on);
        if (!on) onEnable?.();
      }}
      className="group fixed right-4 bottom-4 z-50 flex cursor-pointer items-center gap-2 rounded-full border border-sepia/40 bg-paper/85 px-3 py-1.5 font-script text-lg text-sepia shadow-[0_2px_10px_rgba(58,39,23,0.15)] backdrop-blur-sm transition-colors hover:text-ink"
    >
      <svg viewBox="0 0 28 20" className="h-4 w-6" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 7h4l6-5v16l-6-5H2z" />
        {on ? (
          <>
            <path d="M16 6.5q2.5 3.5 0 7" />
            <path d="M19.5 4q4.5 6 0 12" className="origin-left animate-pulse" />
          </>
        ) : (
          <path d="M17 6l7 8M24 6l-7 8" />
        )}
      </svg>
      {on ? "suono" : "silenzio"}
    </button>
  );
}
