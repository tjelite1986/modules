"use client";

// Template button that starts a job, polls for status, and renders four
// states: idle / pending|running / done / error.
//
// Replace placeholders before use:
//   {{ENTITY}}     PascalCase singular  → Download, ImportJob
//   {{entity}}     camelCase singular   → download, importJob

import { useState, useEffect, useRef } from "react";

type JobStatus = {
  status: "idle" | "pending" | "running" | "done" | "error";
  progress?: string;
  error?: string;
  result?: unknown;
};

interface Props {
  /** The id used in the API path — `/api/{{entities}}/<id>`. */
  jobId: string | number;
  /** Override the API base if your route lives elsewhere. */
  endpoint?: string;
  /** Polling interval in ms. Default 2000. */
  pollMs?: number;
  /** Reload the page when status flips to "done"? Default true. */
  reloadOnDone?: boolean;
  /** Idle button label. */
  idleLabel?: string;
  /** Working label. */
  workingLabel?: string;
  /** Done label. */
  doneLabel?: string;
}

export default function {{ENTITY}}Button({
  jobId,
  endpoint,
  pollMs = 2000,
  reloadOnDone = true,
  idleLabel = "Start",
  workingLabel = "Working...",
  doneLabel = "Complete",
}: Props) {
  const [job, setJob] = useState<JobStatus>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseUrl = endpoint ?? `/api/{{entities}}/${jobId}`;

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(baseUrl);
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJob(data);
      if (data.status === "done" || data.status === "error") {
        stopPoll();
        if (data.status === "done" && reloadOnDone) {
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    } catch {
      /* ignore */
    }
  };

  // On mount: fetch once, start polling if a job is already in flight.
  useEffect(() => {
    fetchStatus().then(() => {
      setJob((prev) => {
        if (prev.status === "pending" || prev.status === "running") {
          if (!pollRef.current) pollRef.current = setInterval(fetchStatus, pollMs);
        }
        return prev;
      });
    });
    return stopPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const start = async () => {
    try {
      const res = await fetch(baseUrl, { method: "POST" });
      if (!res.ok) return;
      setJob({ status: "pending", progress: "Starting..." });
      if (!pollRef.current) pollRef.current = setInterval(fetchStatus, pollMs);
    } catch {
      /* ignore */
    }
  };

  if (job.status === "done") {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {doneLabel}
      </div>
    );
  }

  if (job.status === "error") {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={start}
          className="flex items-center gap-2 text-red-400 text-sm hover:text-red-300 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
          </svg>
          Failed — retry
        </button>
        {job.error && <p className="text-xs text-zinc-500 ml-6">{job.error}</p>}
      </div>
    );
  }

  if (job.status === "pending" || job.status === "running") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <div className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin shrink-0" />
          {workingLabel}
        </div>
        {job.progress && (
          <p className="text-xs text-zinc-500 font-mono ml-5 truncate max-w-xs">
            {job.progress}
          </p>
        )}
      </div>
    );
  }

  // idle
  return (
    <button
      onClick={start}
      className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
    >
      {idleLabel}
    </button>
  );
}
