/**
 * In-memory background job tracker. Lives for the lifetime of the Node.js
 * process — fine for single-instance Next.js apps; if you scale horizontally,
 * swap this for Redis / DB-backed state.
 *
 * Replace placeholders before use:
 *   {{ENTITY}}        PascalCase singular  → e.g. Download, ImportJob
 *   {{entity}}        camelCase singular   → e.g. download, importJob
 *
 * Generic over a string ID (use whatever is unique per job — media id, uuid).
 */

export type JobStatus = "pending" | "running" | "done" | "error";

export type {{ENTITY}}Job = {
  status: JobStatus;
  /** Free-form progress text (e.g. "47% of 12.3 MiB"). */
  progress: string;
  /** Set when status === "error". */
  error?: string;
  /** Free-form result payload — set when status === "done". */
  result?: unknown;
  /** Wall-clock timestamps for diagnostics. */
  startedAt: number;
  updatedAt: number;
};

const jobs = new Map<string, {{ENTITY}}Job>();

export function get{{ENTITY}}Job(id: string): {{ENTITY}}Job | null {
  return jobs.get(id) ?? null;
}

export function set{{ENTITY}}Job(id: string, patch: Partial<{{ENTITY}}Job>): {{ENTITY}}Job {
  const prev = jobs.get(id);
  const merged: {{ENTITY}}Job = {
    status: "pending",
    progress: "",
    startedAt: prev?.startedAt ?? Date.now(),
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
  jobs.set(id, merged);
  return merged;
}

export function delete{{ENTITY}}Job(id: string): void {
  jobs.delete(id);
}

/** Garbage-collect terminal jobs older than `maxAgeMs`. */
export function gc{{ENTITY}}Jobs(maxAgeMs = 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const [id, job] of jobs) {
    if ((job.status === "done" || job.status === "error") && job.updatedAt < cutoff) {
      jobs.delete(id);
      removed++;
    }
  }
  return removed;
}

/** True if a job is currently in flight (not done/error). */
export function is{{ENTITY}}Active(id: string): boolean {
  const job = jobs.get(id);
  return job ? job.status === "pending" || job.status === "running" : false;
}
