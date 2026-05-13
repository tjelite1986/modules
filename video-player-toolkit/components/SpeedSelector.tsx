"use client";
import { useEffect, useState, RefObject } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const STORAGE_KEY = "video_player_speed";

/**
 * A row of pill buttons for picking the playback speed of a <video> or <audio>.
 * Persists the chosen speed in localStorage and re-applies it on every new src.
 */
export default function SpeedSelector({
  videoRef,
}: {
  videoRef: RefObject<HTMLVideoElement | HTMLAudioElement>;
}) {
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    return parseFloat(localStorage.getItem(STORAGE_KEY) ?? "1") || 1;
  });

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = speed;
    const onLoaded = () => {
      el.playbackRate = speed;
    };
    el.addEventListener("loadedmetadata", onLoaded);
    return () => el.removeEventListener("loadedmetadata", onLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, speed]);

  const select = (s: number) => {
    setSpeed(s);
    localStorage.setItem(STORAGE_KEY, String(s));
    const el = videoRef.current;
    if (el) el.playbackRate = s;
  };

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      <span className="text-xs text-gray-400 mr-1">Speed</span>
      {SPEEDS.map((s) => (
        <button
          key={s}
          onClick={() => select(s)}
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
            speed === s
              ? "bg-white text-black"
              : "bg-zinc-800 border border-zinc-700 text-gray-400 hover:text-white hover:border-white/30"
          }`}
        >
          {s === 1 ? "1×" : `${s}×`}
        </button>
      ))}
    </div>
  );
}
