/**
 * On-screen-display overlay used together with usePlayerKeyboard().
 * Renders the transient text returned from the hook ("▶", "+10s", "Vol 80%")
 * over the video, fading out after ~900ms.
 *
 * Position this absolutely inside the same container as your <video>:
 *
 *   <div className="relative">
 *     <video ref={videoRef} ... />
 *     <PlayerOsd text={osd} />
 *   </div>
 */
export default function PlayerOsd({ text }: { text: string | null }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-opacity duration-300 ${
        text ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="bg-black/70 text-white text-xl font-semibold px-5 py-2.5 rounded-2xl">
        {text ?? ""}
      </span>
    </div>
  );
}
