"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";

const SESSION_KEY = "shorts18_pin_ok";

function authHeaders() {
  return {
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : ""}`,
  };
}

export default function AdultsPinGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "open" | "locked">("checking");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") {
      setState("open");
      return;
    }
    fetch("/api/users/me/adults-pin", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setState(d?.enabled ? "locked" : "open"))
      .catch(() => setState("open"));
  }, []);

  useEffect(() => {
    if (state === "locked") {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [state]);

  async function submit() {
    if (busy || !pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/adults-pin/verify", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Wrong PIN");
        setPin("");
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "1");
      setState("open");
    } finally {
      setBusy(false);
    }
  }

  if (state === "open") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Checking lock...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-400">
          <Lock size={18} />
          <h2 className="text-lg font-semibold text-white">Locked</h2>
        </div>
        <p className="text-sm text-gray-400">
          This section is PIN-protected. Enter your PIN to continue. Manage your
          PIN in Settings.
        </p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="\d*"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="••••"
          className="input w-full text-center text-2xl tracking-[0.5em]"
        />
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !pin}
          className="btn-primary w-full justify-center"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Unlock"}
        </button>
      </div>
    </div>
  );
}
