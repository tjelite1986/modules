"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password.");
      return;
    }
    router.push(res?.url || callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl p-6 space-y-4 border border-zinc-800/50">
      <div>
        <label className="block text-sm font-medium mb-1.5">Username</label>
        <input
          type="text"
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
          required
        />
      </div>
      {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 transition disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-zinc-400 mt-1">Continue to your account</p>
        </div>
        <Suspense fallback={<div className="bg-zinc-900 rounded-2xl p-6 h-48 animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
