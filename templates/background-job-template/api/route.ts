// Template for a background-job endpoint.
//
// Replace placeholders before use:
//   {{ENTITY}}     PascalCase singular  → Download, ImportJob, Transcode
//   {{entity}}     camelCase singular   → download, importJob, transcode
//   {{entities}}   plural lowercase     → downloads, import-jobs, transcodes
//
// Pattern: GET returns the current job state, POST starts a new one.
// The handler itself is fire-and-forget — it spawns the long-running task,
// returns "started" immediately, and the client polls GET until status is
// "done" or "error".

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  get{{ENTITY}}Job,
  set{{ENTITY}}Job,
  is{{ENTITY}}Active,
} from "@/lib/job-store";

// GET — current job status
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = get{{ENTITY}}Job(params.id);
  if (!job) return NextResponse.json({ status: "idle" });
  return NextResponse.json(job);
}

// POST — start the job
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (is{{ENTITY}}Active(params.id)) {
    return NextResponse.json({ error: "Already in progress" }, { status: 409 });
  }

  set{{ENTITY}}Job(params.id, { status: "pending", progress: "Starting..." });

  // Kick off the actual work — replace this with whatever you need to run.
  // Don't await; return immediately so the client can start polling.
  run{{ENTITY}}(params.id, req).catch((err) => {
    set{{ENTITY}}Job(params.id, {
      status: "error",
      progress: "",
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return NextResponse.json({ status: "started" });
}

// REPLACE this with the long-running work for your entity. Update the
// job-store every time you have meaningful progress.
async function run{{ENTITY}}(id: string, _req: NextRequest): Promise<void> {
  set{{ENTITY}}Job(id, { status: "running", progress: "Working..." });

  // Example: spawn yt-dlp and parse stderr for progress (see playlist-import-job
  // and elitetube's downloads route for real implementations).
  //
  //   const child = spawn("yt-dlp", [...args]);
  //   child.stderr.on("data", (data) => {
  //     const line = data.toString().trim();
  //     if (line.includes("[download]") && line.includes("%")) {
  //       set{{ENTITY}}Job(id, { status: "running", progress: line });
  //     }
  //   });
  //   await new Promise((resolve, reject) =>
  //     child.on("close", (code) => (code === 0 ? resolve(null) : reject(new Error(`exit ${code}`)))),
  //   );

  set{{ENTITY}}Job(id, {
    status: "done",
    progress: "Complete",
    result: { /* whatever the caller needs */ },
  });
}
