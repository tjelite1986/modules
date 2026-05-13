"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";

interface Props {
  onUploaded: () => void;
}

function authToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("auth_token") ?? "";
}

export default function UploadDropzone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setBusy(true);
      setErrors([]);
      setProgress(`Uploading 0 / ${list.length}…`);

      const collected: string[] = [];
      let done = 0;

      const CONCURRENCY = 8;
      const queue = list.slice();

      const worker = async () => {
        while (true) {
          const file = queue.shift();
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          try {
            const res = await fetch("/api/gallery/upload", {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken()}` },
              body: fd,
            });
            if (!res.ok) {
              collected.push(`${file.name}: upload failed (${res.status})`);
            } else {
              const data = await res.json();
              if (Array.isArray(data.errors)) {
                for (const e of data.errors) {
                  collected.push(`${e.filename}: ${e.error}`);
                }
              }
            }
          } catch (err: any) {
            collected.push(`${file.name}: ${err?.message || "Network error"}`);
          }
          done += 1;
          setProgress(`Uploading ${done} / ${list.length}…`);
        }
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(CONCURRENCY, list.length); i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      setBusy(false);
      setProgress("");
      setErrors(collected);
      onUploaded();
    },
    [onUploaded],
  );

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer.files) upload(e.dataTransfer.files);
      }}
      className={`relative rounded-xl border-2 border-dashed transition-colors ${
        dragOver
          ? "border-violet-400 bg-violet-500/10"
          : "border-gray-700 hover:border-gray-500"
      } p-6 flex flex-col items-center justify-center gap-2 text-center`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {busy ? (
        <Loader2 className="w-8 h-8 text-violet-300 animate-spin" />
      ) : (
        <CloudUpload className="w-8 h-8 text-violet-300" />
      )}
      <div className="text-sm text-gray-200">
        {busy ? progress : "Drop photos and videos here, or"}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-sm text-white disabled:opacity-50"
      >
        Choose files
      </button>
      {errors.length > 0 && (
        <ul className="mt-2 text-xs text-red-300 list-disc list-inside max-h-24 overflow-auto">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
