import { useEffect, useState, useRef, RefObject } from "react";

/**
 * Keyboard shortcuts for video/audio players.
 *
 *   Space / K   — play/pause
 *   ← / J       — seek -10s
 *   → / L       — seek +10s
 *   ↑           — volume +5%
 *   ↓           — volume -5%
 *   M           — mute/unmute
 *   F           — fullscreen toggle (video only)
 *   0–9         — jump to 0–90% of duration
 *
 * Returns `{ osd }`, a short status string ("▶", "+10s", "Vol 80%") that
 * vanishes after ~900ms — feed it into a transient overlay (see PlayerOsd).
 *
 * Skips key handling when the user is typing in an input/textarea/select
 * or contentEditable element.
 */
export function usePlayerKeyboard(
  videoRef: RefObject<HTMLVideoElement | HTMLAudioElement>,
) {
  const [osd, setOsd] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(text: string) {
    setOsd(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOsd(null), 900);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      const el = videoRef.current;
      if (!el) return;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (el.paused) {
            el.play().catch(() => {});
            show("▶");
          } else {
            el.pause();
            show("⏸");
          }
          break;

        case "ArrowRight":
        case "l":
        case "L":
          e.preventDefault();
          el.currentTime = Math.min(el.currentTime + 10, el.duration || 0);
          show("▶▶ +10s");
          break;

        case "ArrowLeft":
        case "j":
        case "J":
          e.preventDefault();
          el.currentTime = Math.max(el.currentTime - 10, 0);
          show("◀◀ −10s");
          break;

        case "ArrowUp":
          e.preventDefault();
          el.volume = Math.min(el.volume + 0.05, 1);
          show(`Vol ${Math.round(el.volume * 100)}%`);
          break;

        case "ArrowDown":
          e.preventDefault();
          el.volume = Math.max(el.volume - 0.05, 0);
          show(`Vol ${Math.round(el.volume * 100)}%`);
          break;

        case "m":
        case "M":
          e.preventDefault();
          el.muted = !el.muted;
          show(el.muted ? "Muted" : "Unmuted");
          break;

        case "f":
        case "F":
          e.preventDefault();
          if (el instanceof HTMLVideoElement) {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              el.requestFullscreen?.();
            }
          }
          break;

        default:
          if (e.key >= "0" && e.key <= "9") {
            e.preventDefault();
            const pct = parseInt(e.key) * 10;
            el.currentTime = (el.duration || 0) * (pct / 100);
            show(`${pct}%`);
          }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [videoRef]);

  return { osd };
}
