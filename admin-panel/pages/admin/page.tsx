'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Code {
  id: number;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const token = () => localStorage.getItem('auth_token') ?? '';
  const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  useEffect(() => {
    fetch('/api/admin/codes', { headers: headers() })
      .then(r => {
        if (r.status === 403) { router.replace('/'); return null; }
        return r.json();
      })
      .then(data => { if (data) setCodes(data); setLoading(false); });
  }, []);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch('/api/admin/codes', { method: 'POST', headers: headers() });
    const data = await res.json();
    setGenerating(false);
    if (data.code) setCodes(prev => [{ id: Date.now(), code: data.code, usedBy: null, usedAt: null, createdAt: new Date().toISOString() }, ...prev]);
  };

  const remove = async (code: string) => {
    await fetch('/api/admin/codes', { method: 'DELETE', headers: headers(), body: JSON.stringify({ code }) });
    setCodes(prev => prev.filter(c => c.code !== code));
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

  const unused = codes.filter(c => !c.usedBy);
  const used = codes.filter(c => c.usedBy);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 bg-black border-b border-gray-800 px-4 py-4 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-2xl leading-none">‹</button>
        <h1 className="text-xl font-bold flex-1">Admin — Invite codes</h1>
        <button
          onClick={generate}
          disabled={generating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          {generating ? '...' : '+ Generate'}
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {loading && <p className="text-gray-500 text-center py-8">Loading...</p>}

        {unused.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Unused codes ({unused.length})
            </h2>
            <div className="space-y-2">
              {unused.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3">
                  <span className="font-mono text-lg text-white tracking-widest flex-1">{c.code}</span>
                  <span className="text-xs text-gray-600">{formatDate(c.createdAt)}</span>
                  <button
                    onClick={() => copy(c.code)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copied === c.code ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => remove(c.code)}
                    className="text-red-500 hover:text-red-400 text-sm px-1"
                    title="Delete"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && unused.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            <p className="text-sm">No unused codes. Press Generate to create one.</p>
          </div>
        )}

        {used.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Used codes ({used.length})
            </h2>
            <div className="space-y-2">
              {used.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-gray-900/50 rounded-xl px-4 py-3 opacity-60">
                  <span className="font-mono text-base text-gray-500 tracking-widest flex-1 line-through">{c.code}</span>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{c.usedBy}</p>
                    <p className="text-xs text-gray-600">{c.usedAt ? formatDate(c.usedAt) : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
