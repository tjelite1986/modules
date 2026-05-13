import { useEffect, useRef, useState } from "react";

const STORAGE_PREFIX =
  process.env.NEXT_PUBLIC_VIDEO_RESUME_PREFIX || "video_resume_";

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Persist video playback position in localStorage and resume on next load.
 *
 *   const { videoRef, resumedFrom } = useVideoResume(item.id);
 *   <video ref={videoRef} src={src} controls />
 *   {resumedFrom && <span>Resumed from {resumedFrom}</span>}
 *
 * - Saves position every 5 seconds while playing.
 * - On load, restores position only if > 10s into the video AND not within 95% of the end.
 * - Clears position when the video ends.
 *
 * Pass `active=false` to disable (useful when the source is still loading).
 *
 * The localStorage prefix can be customised globally via the
 * `NEXT_PUBLIC_VIDEO_RESUME_PREFIX` env var (default: `video_resume_`).
 * This matters if the same browser hosts multiple apps that use this hook.
 */
export function useVideoResume(key: string | number, active = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resumedFrom, setResumedFrom] = useState<string | null>(null);
  const storageKey = `${STORAGE_PREFIX}${key}`;

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    const saved = parseFloat(localStorage.getItem(storageKey) ?? "0");

    const onLoaded = () => {
      if (saved > 10 && video.duration > 0 && saved < video.duration * 0.95) {
        video.currentTime = saved;
        setResumedFrom(fmt(saved));
        const t = setTimeout(() => setResumedFrom(null), 4000);
        return () => clearTimeout(t);
      }
    };

    let lastSaved = 0;
    const onTimeUpdate = () => {
      if (Math.abs(video.currentTime - lastSaved) >= 5) {
        localStorage.setItem(storageKey, String(Math.floor(video.currentTime)));
        lastSaved = video.currentTime;
      }
    };

    const onEnded = () => localStorage.removeItem(storageKey);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, active]);

  return { videoRef, resumedFrom };
}

/** Read all stored resume positions for a list of media keys. Useful for a "Continue watching" carousel. */
export function readResumePositions(): { key: string; seconds: number }[] {
  if (typeof window === "undefined") return [];
  const out: { key: string; seconds: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(STORAGE_PREFIX)) continue;
    const key = k.slice(STORAGE_PREFIX.length);
    const seconds = parseFloat(localStorage.getItem(k) ?? "0");
    if (seconds > 10) out.push({ key, seconds });
  }
  return out;
}
