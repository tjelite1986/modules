"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Endpoint that verifies the PIN. Default: /api/gate/verify-pin */
  verifyEndpoint?: string;
  /** Title shown above the keypad. */
  title?: string;
  /** Description shown under the title. */
  description?: string;
  /** Emoji or icon shown above the title. */
  icon?: string;
  /** Maximum PIN length. */
  maxLength?: number;
  /** Minimum PIN length to enable submit. */
  minLength?: number;
}

/**
 * Numeric keypad for entering a PIN. POSTs `{ pin }` to verifyEndpoint and
 * refreshes the route on success (so server components can re-render with the
 * gate cookie now set).
 *
 * Use anywhere a server component decides the user must verify before
 * proceeding, e.g.:
 *
 *   const cookieStore = cookies();
 *   if (!cookieStore.get("gate_unlocked")) return <PinGate />;
 */
export default function PinGate({
  verifyEndpoint = "/api/gate/verify-pin",
  title = "Verification required",
  description = "Enter your PIN code to continue.",
  icon = "🔒",
  maxLength = 8,
  minLength = 4,
}: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(verifyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Wrong PIN");
      setPin("");
    }
  }

  function handleKeypad(digit: string) {
    if (pin.length < maxLength) setPin((prev) => prev + digit);
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1));
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
        <p className="text-sm text-zinc-400 mb-6">{description}</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: Math.max(pin.length, minLength) }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 ${
                i < pin.length
                  ? "bg-red-600 border-red-600"
                  : "border-zinc-700 bg-transparent"
              }`}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleKeypad(d)}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl py-3 text-lg font-semibold text-white transition-colors"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl py-3 text-sm text-zinc-400 transition-colors"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => handleKeypad("0")}
              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl py-3 text-lg font-semibold text-white transition-colors"
            >
              0
            </button>
            <button
              type="submit"
              disabled={pin.length < minLength || loading}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl py-3 text-sm font-semibold text-white transition-colors"
            >
              {loading ? "..." : "OK"}
            </button>
          </div>
        </form>

        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
}
