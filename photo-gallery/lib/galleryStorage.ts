import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT =
  process.env.GALLERY_ROOT || path.join(process.cwd(), "data", "gallery");

export const ORIGINALS_DIR = path.join(STORAGE_ROOT, "originals");
export const THUMBS_DIR = path.join(STORAGE_ROOT, "thumbs");
export const PREVIEWS_DIR = path.join(STORAGE_ROOT, "previews");

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi", "3gp"]);

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

export type MediaKind = "image" | "video";

export interface IngestPaths {
  storageKey: string;
  ext: string;
  originalPath: string;
  thumbPath: string;
  previewPath: string;
  userOriginalsDir: string;
}

export function detectKind(filename: string, mime: string): MediaKind | null {
  const ext = (path.extname(filename).slice(1) || "").toLowerCase();
  if (IMAGE_EXTS.has(ext) || IMAGE_MIME.has(mime) || mime.startsWith("image/"))
    return "image";
  if (VIDEO_EXTS.has(ext) || mime.startsWith("video/")) return "video";
  return null;
}

export function getExt(filename: string): string {
  return (path.extname(filename).slice(1) || "bin").toLowerCase();
}

export function ensureDirs() {
  for (const d of [STORAGE_ROOT, ORIGINALS_DIR, THUMBS_DIR, PREVIEWS_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function planIngest(userId: number, filename: string, takenAt: Date): IngestPaths {
  const ext = getExt(filename);
  const yyyy = String(takenAt.getUTCFullYear());
  const mm = String(takenAt.getUTCMonth() + 1).padStart(2, "0");
  const uuid = randomUUID();
  const userOriginalsDir = path.join(ORIGINALS_DIR, String(userId), yyyy, mm);
  const userThumbsDir = path.join(THUMBS_DIR, String(userId));
  const userPreviewsDir = path.join(PREVIEWS_DIR, String(userId));
  for (const d of [userOriginalsDir, userThumbsDir, userPreviewsDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  const storageKey = `${yyyy}/${mm}/${uuid}.${ext}`;
  return {
    storageKey,
    ext,
    originalPath: path.join(userOriginalsDir, `${uuid}.${ext}`),
    thumbPath: path.join(userThumbsDir, `${uuid}.jpg`),
    previewPath: path.join(userPreviewsDir, `${uuid}.jpg`),
    userOriginalsDir,
  };
}

export function originalPath(userId: number, storageKey: string): string {
  return path.join(ORIGINALS_DIR, String(userId), storageKey);
}

export function thumbPath(userId: number, storageKey: string): string {
  const uuid = path.basename(storageKey).replace(/\.[^.]+$/, "");
  return path.join(THUMBS_DIR, String(userId), `${uuid}.jpg`);
}

export function previewPath(userId: number, storageKey: string): string {
  const uuid = path.basename(storageKey).replace(/\.[^.]+$/, "");
  return path.join(PREVIEWS_DIR, String(userId), `${uuid}.jpg`);
}

export function moveOriginalByDate(
  userId: number,
  storageKey: string,
  takenAt: Date,
): string | null {
  const yyyy = String(takenAt.getUTCFullYear());
  const mm = String(takenAt.getUTCMonth() + 1).padStart(2, "0");
  const parts = storageKey.split("/");
  if (parts.length < 3) return null;
  const [oldYyyy, oldMm] = parts;
  const fileName = parts.slice(2).join("/");
  if (oldYyyy === yyyy && oldMm === mm) return storageKey;
  const oldFull = originalPath(userId, storageKey);
  if (!fs.existsSync(oldFull)) return null;
  const newDir = path.join(ORIGINALS_DIR, String(userId), yyyy, mm);
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
  const newFull = path.join(newDir, fileName);
  try {
    fs.renameSync(oldFull, newFull);
  } catch {
    return null;
  }
  try {
    const oldDir = path.dirname(oldFull);
    if (fs.readdirSync(oldDir).length === 0) fs.rmdirSync(oldDir);
  } catch {}
  return `${yyyy}/${mm}/${fileName}`;
}

export function deleteFiles(userId: number, storageKey: string) {
  for (const p of [
    originalPath(userId, storageKey),
    thumbPath(userId, storageKey),
    previewPath(userId, storageKey),
  ]) {
    try {
      fs.unlinkSync(p);
    } catch {}
  }
}

interface FfprobeResult {
  width?: number;
  height?: number;
  durationMs?: number;
}

export async function ffprobeMedia(file: string): Promise<FfprobeResult> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      file,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve({}));
    proc.on("close", () => {
      try {
        const data = JSON.parse(out);
        const stream = data.streams?.[0] || {};
        const duration = parseFloat(data.format?.duration || "");
        resolve({
          width: stream.width ?? undefined,
          height: stream.height ?? undefined,
          durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : undefined,
        });
      } catch {
        resolve({});
      }
    });
  });
}

async function runCmd(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

async function runFfmpeg(args: string[]): Promise<boolean> {
  return runCmd("ffmpeg", args);
}

const HEIF_EXTS = new Set([".heic", ".heif", ".heics", ".heifs"]);

export async function heifToJpeg(src: string): Promise<string | null> {
  const tmp = path.join(os.tmpdir(), `heif-${randomUUID()}.jpg`);
  const ok = await runCmd("heif-convert", ["-q", "92", src, tmp]);
  if (ok && fs.existsSync(tmp)) return tmp;
  try {
    fs.unlinkSync(tmp);
  } catch {}
  return null;
}

async function ffmpegImageScale(
  src: string,
  dst: string,
  maxSide: number,
  quality: number,
) {
  return runFfmpeg([
    "-y",
    "-loglevel",
    "error",
    "-i",
    src,
    "-vf",
    `scale='if(gt(iw,ih),min(${maxSide},iw),-2)':'if(gt(iw,ih),-2,min(${maxSide},ih))',format=yuvj420p`,
    "-q:v",
    String(quality),
    "-frames:v",
    "1",
    dst,
  ]);
}

export function isHeifPath(file: string): boolean {
  return HEIF_EXTS.has(path.extname(file).toLowerCase());
}

export async function makeImageThumb(src: string, dst: string, maxSide: number, quality: number) {
  // HEIF must go through libheif first: ffmpeg "succeeds" on tiled HEIC/HEIF
  // by decoding a single 512x512 grid tile, which renders as an extremely
  // zoomed-in crop. Only fall back to direct ffmpeg if conversion fails.
  if (isHeifPath(src)) {
    const tmp = await heifToJpeg(src);
    if (tmp) {
      try {
        const ok = await ffmpegImageScale(tmp, dst, maxSide, quality);
        if (ok && fs.existsSync(dst)) return true;
      } finally {
        try {
          fs.unlinkSync(tmp);
        } catch {}
      }
    }
  }

  const ok = await ffmpegImageScale(src, dst, maxSide, quality);
  return ok && fs.existsSync(dst);
}

export async function rotateImageInPlace(
  src: string,
  degrees: 90 | 180 | 270,
): Promise<{ ok: boolean; width?: number; height?: number }> {
  const tmp = path.join(os.tmpdir(), `rot-${randomUUID()}${path.extname(src)}`);
  const ext = path.extname(src).toLowerCase();
  const isHeif = HEIF_EXTS.has(ext);

  let inputPath = src;
  let convertedTmp: string | null = null;
  if (isHeif) {
    const converted = await heifToJpeg(src);
    if (!converted) return { ok: false };
    convertedTmp = converted;
    inputPath = converted;
  }

  const filter =
    degrees === 90
      ? "transpose=1"
      : degrees === 180
        ? "transpose=1,transpose=1"
        : "transpose=2";

  const args = [
    "-y",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-vf",
    filter,
    "-q:v",
    "2",
    tmp,
  ];
  const ok = await runFfmpeg(args);
  if (convertedTmp) {
    try {
      fs.unlinkSync(convertedTmp);
    } catch {}
  }
  if (!ok || !fs.existsSync(tmp)) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    return { ok: false };
  }

  try {
    fs.copyFileSync(tmp, src);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }

  const probed = await ffprobeMedia(src);
  return { ok: true, width: probed.width, height: probed.height };
}

export async function makeVideoThumb(src: string, dst: string, maxSide: number, quality: number) {
  const ok = await runFfmpeg([
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "00:00:01",
    "-i",
    src,
    "-vf",
    `scale='if(gt(iw,ih),min(${maxSide},iw),-2)':'if(gt(iw,ih),-2,min(${maxSide},ih))'`,
    "-vframes",
    "1",
    "-q:v",
    String(quality),
    dst,
  ]);
  if (ok && fs.existsSync(dst)) return true;
  return runFfmpeg([
    "-y",
    "-loglevel",
    "error",
    "-i",
    src,
    "-vf",
    `select='eq(n\\,0)',scale='if(gt(iw,ih),min(${maxSide},iw),-2)':'if(gt(iw,ih),-2,min(${maxSide},ih))'`,
    "-vframes",
    "1",
    "-q:v",
    String(quality),
    dst,
  ]);
}
