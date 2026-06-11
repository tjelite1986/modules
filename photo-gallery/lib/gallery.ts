import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import { parseFilenameDate } from "./filenameDate";
import {
  detectKind,
  ensureDirs,
  ffprobeMedia,
  heifToJpeg,
  isHeifPath,
  makeImageThumb,
  makeVideoThumb,
  moveOriginalByDate,
  originalPath,
  planIngest,
  previewPath,
  rotateImageInPlace,
  thumbPath,
  deleteFiles,
  type MediaKind,
} from "./galleryStorage";

const THUMB_MAX = 480;
const PREVIEW_MAX = 1600;
const THUMB_QUALITY = 5;
const PREVIEW_QUALITY = 3;

export type GalleryTab = "timeline" | "favorites" | "trash";

export interface GalleryItem {
  id: number;
  user_id: number;
  filename: string;
  storage_key: string;
  kind: MediaKind;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  taken_at: string;
  uploaded_at: string;
  thumbnail_ready: number;
  preview_ready: number;
  is_favorite: number;
  is_deleted: number;
  deleted_at: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  rating: number;
  tag_count?: number;
}

export interface GalleryAlbum {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  cover_item_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AlbumWithCounts extends GalleryAlbum {
  item_count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

interface IngestInput {
  userId: number;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  fallbackTakenAt?: Date;
}

export interface ExifReadout {
  make?: string;
  model?: string;
  lens?: string;
  iso?: number;
  aperture?: number;
  shutter?: string;
  focal_length?: number;
  flash?: string;
  orientation?: number;
  gps?: { lat: number; lng: number };
  taken_at?: string;
  software?: string;
}

function formatShutter(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  if (value >= 1) return `${value}s`;
  const denom = Math.round(1 / value);
  return `1/${denom}s`;
}

export async function backfillGeotag(
  userId: number,
  itemId: number,
): Promise<{ latitude: number; longitude: number } | null> {
  const item = getItem(userId, itemId);
  if (!item || item.kind !== "image") return null;
  if (item.latitude != null && item.longitude != null) {
    return { latitude: item.latitude, longitude: item.longitude };
  }
  const exif = await readItemExif(originalPath(userId, item.storage_key));
  if (!exif.gps) return null;
  const db = getDb();
  db.prepare(
    "UPDATE gallery_items SET latitude = ?, longitude = ? WHERE id = ? AND user_id = ?",
  ).run(exif.gps.lat, exif.gps.lng, itemId, userId);
  return { latitude: exif.gps.lat, longitude: exif.gps.lng };
}

export function setLocationName(
  userId: number,
  itemId: number,
  name: string | null,
): void {
  const db = getDb();
  db.prepare(
    "UPDATE gallery_items SET location_name = ? WHERE id = ? AND user_id = ?",
  ).run(name, itemId, userId);
}

export async function readItemExif(filePath: string): Promise<ExifReadout> {
  try {
    const exifr = await import("exifr");
    const data: any = await exifr.parse(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: false,
      xmp: false,
      icc: false,
      pick: [
        "Make",
        "Model",
        "LensModel",
        "LensMake",
        "ISO",
        "FNumber",
        "ApertureValue",
        "ExposureTime",
        "FocalLength",
        "Flash",
        "Orientation",
        "DateTimeOriginal",
        "CreateDate",
        "DateTime",
        "Software",
        "latitude",
        "longitude",
      ],
    } as any);
    if (!data) return {};
    const taken = data.DateTimeOriginal || data.CreateDate || data.DateTime;
    const result: ExifReadout = {
      make: typeof data.Make === "string" ? data.Make.trim() : undefined,
      model: typeof data.Model === "string" ? data.Model.trim() : undefined,
      lens:
        typeof data.LensModel === "string"
          ? data.LensModel.trim()
          : typeof data.LensMake === "string"
            ? data.LensMake.trim()
            : undefined,
      iso: typeof data.ISO === "number" ? data.ISO : undefined,
      aperture:
        typeof data.FNumber === "number"
          ? data.FNumber
          : typeof data.ApertureValue === "number"
            ? data.ApertureValue
            : undefined,
      shutter: formatShutter(data.ExposureTime),
      focal_length:
        typeof data.FocalLength === "number" ? data.FocalLength : undefined,
      flash: typeof data.Flash === "string" ? data.Flash : undefined,
      orientation:
        typeof data.Orientation === "number" ? data.Orientation : undefined,
      software: typeof data.Software === "string" ? data.Software.trim() : undefined,
      taken_at:
        taken instanceof Date && !Number.isNaN(taken.valueOf())
          ? taken.toISOString()
          : undefined,
      gps:
        typeof data.latitude === "number" && typeof data.longitude === "number"
          ? { lat: data.latitude, lng: data.longitude }
          : undefined,
    };
    for (const key of Object.keys(result) as (keyof ExifReadout)[]) {
      if (result[key] === undefined) delete result[key];
    }
    return result;
  } catch {
    return {};
  }
}

async function readExifGps(
  buffer: Buffer,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const exifr = await import("exifr");
    const data: any = await exifr.parse(buffer, { gps: true } as any);
    if (
      data &&
      typeof data.latitude === "number" &&
      typeof data.longitude === "number"
    ) {
      return { lat: data.latitude, lng: data.longitude };
    }
  } catch {}
  return null;
}


async function readExifTakenAt(source: Buffer | string): Promise<Date | null> {
  try {
    const exifr = await import("exifr");
    const data = await exifr.parse(source, ["DateTimeOriginal", "CreateDate", "DateTime"]);
    if (!data) return null;
    const candidate = data.DateTimeOriginal || data.CreateDate || data.DateTime;
    if (candidate instanceof Date && !Number.isNaN(candidate.valueOf())) return candidate;
    if (typeof candidate === "string") {
      const d = new Date(candidate);
      if (!Number.isNaN(d.valueOf())) return d;
    }
  } catch {}
  return null;
}

export async function ingestUpload(input: IngestInput): Promise<GalleryItem> {
  const kind = detectKind(input.filename, input.mimeType);
  if (!kind) throw new Error("Unsupported file type");

  ensureDirs();

  const contentHash = createHash("sha256").update(input.buffer).digest("hex");
  const db0 = getDb();
  const existing = db0
    .prepare(
      `SELECT * FROM gallery_items
        WHERE user_id = ? AND content_hash = ? AND is_deleted = 0
        ORDER BY id ASC LIMIT 1`,
    )
    .get(input.userId, contentHash) as GalleryItem | undefined;
  if (existing) return existing;

  const exifDate = kind === "image" ? await readExifTakenAt(input.buffer) : null;
  const takenAt =
    exifDate || parseFilenameDate(input.filename) || input.fallbackTakenAt || new Date();
  const gps = kind === "image" ? await readExifGps(input.buffer) : null;

  const paths = planIngest(input.userId, input.filename, takenAt);
  fs.writeFileSync(paths.originalPath, input.buffer);

  // ffprobe/ffmpeg can't decode tiled HEIF correctly (they see one 512px
  // grid tile), so convert once via libheif and derive probe + thumbnails
  // from the JPEG.
  const heifJpeg =
    kind === "image" && isHeifPath(paths.originalPath)
      ? await heifToJpeg(paths.originalPath)
      : null;
  const mediaSrc = heifJpeg ?? paths.originalPath;

  let width: number | undefined;
  let height: number | undefined;
  let durationMs: number | undefined;
  try {
    const probed = await ffprobeMedia(mediaSrc);
    width = probed.width;
    height = probed.height;
    durationMs = probed.durationMs;
  } catch {}

  const thumbOk = kind === "image"
    ? await makeImageThumb(mediaSrc, paths.thumbPath, THUMB_MAX, THUMB_QUALITY)
    : await makeVideoThumb(paths.originalPath, paths.thumbPath, THUMB_MAX, THUMB_QUALITY);

  const previewOk = kind === "image"
    ? await makeImageThumb(mediaSrc, paths.previewPath, PREVIEW_MAX, PREVIEW_QUALITY)
    : await makeVideoThumb(paths.originalPath, paths.previewPath, PREVIEW_MAX, PREVIEW_QUALITY);

  if (heifJpeg) {
    try {
      fs.unlinkSync(heifJpeg);
    } catch {}
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO gallery_items
        (user_id, filename, storage_key, kind, mime_type, size_bytes,
         width, height, duration_ms, taken_at, thumbnail_ready, preview_ready,
         latitude, longitude, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.filename,
      paths.storageKey,
      kind,
      input.mimeType || (kind === "image" ? "image/jpeg" : "video/mp4"),
      input.buffer.length,
      width ?? null,
      height ?? null,
      durationMs ?? null,
      takenAt.toISOString(),
      thumbOk ? 1 : 0,
      previewOk ? 1 : 0,
      gps?.lat ?? null,
      gps?.lng ?? null,
      contentHash,
    );
  const id = Number(result.lastInsertRowid);
  const yearTag = String(takenAt.getUTCFullYear());
  if (/^\d{4}$/.test(yearTag)) {
    db.prepare("INSERT OR IGNORE INTO gallery_tags (item_id, tag) VALUES (?, ?)").run(
      id,
      yearTag,
    );
  }
  return db.prepare("SELECT * FROM gallery_items WHERE id = ?").get(id) as GalleryItem;
}

export function backfillYearTags(userId: number): { added: number; updated: number } {
  const db = getDb();
  const items = db
    .prepare(
      "SELECT id, taken_at FROM gallery_items WHERE user_id = ? AND is_deleted = 0",
    )
    .all(userId) as { id: number; taken_at: string }[];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO gallery_tags (item_id, tag) VALUES (?, ?)",
  );
  let added = 0;
  const tx = db.transaction((rows: typeof items) => {
    for (const it of rows) {
      const date = new Date(it.taken_at);
      const year = date.getUTCFullYear();
      if (!Number.isFinite(year)) continue;
      const tag = String(year);
      if (!/^\d{4}$/.test(tag)) continue;
      const result = insert.run(it.id, tag);
      if (result.changes > 0) added += 1;
    }
  });
  tx(items);
  return { added, updated: items.length };
}

// Re-dates items whose filename encodes a capture date that differs from the
// stored taken_at. EXIF stays authoritative: items whose original file still
// carries an EXIF date are left untouched — this only rescues media where
// taken_at fell back to upload time / file mtime (WhatsApp images, videos,
// screenshots).
export async function backfillFilenameDates(userId: number): Promise<{
  scanned: number;
  parsed: number;
  updated: number;
  skipped_exif: number;
  skipped_match: number;
}> {
  const db = getDb();
  const items = db
    .prepare(
      `SELECT id, filename, storage_key, kind, taken_at
         FROM gallery_items WHERE user_id = ? AND is_deleted = 0`,
    )
    .all(userId) as Pick<GalleryItem, "id" | "filename" | "storage_key" | "kind" | "taken_at">[];

  let parsed = 0;
  let updated = 0;
  let skippedExif = 0;
  let skippedMatch = 0;

  for (const it of items) {
    const want = parseFilenameDate(it.filename);
    if (!want) continue;
    parsed += 1;

    const cur = new Date(it.taken_at);
    const sameDay =
      !Number.isNaN(cur.getTime()) &&
      cur.getUTCFullYear() === want.getUTCFullYear() &&
      cur.getUTCMonth() === want.getUTCMonth() &&
      cur.getUTCDate() === want.getUTCDate();
    if (sameDay) {
      skippedMatch += 1;
      continue;
    }

    if (it.kind === "image") {
      const orig = originalPath(userId, it.storage_key);
      if (fs.existsSync(orig) && (await readExifTakenAt(orig))) {
        skippedExif += 1;
        continue;
      }
    }

    if (setTakenAt(userId, it.id, want.toISOString())) updated += 1;
  }

  if (updated > 0) backfillYearTags(userId);
  return { scanned: items.length, parsed, updated, skipped_exif: skippedExif, skipped_match: skippedMatch };
}

export interface ListOptions {
  tab?: GalleryTab;
  cursor?: string | null;
  limit?: number;
  albumId?: number;
  tag?: string;
  year?: number;
  from?: string;
  to?: string;
  order?: "asc" | "desc" | "custom";
  minRating?: number;
}

export interface ListResult {
  items: GalleryItem[];
  nextCursor: string | null;
}

export function listItems(userId: number, opts: ListOptions = {}): ListResult {
  if (opts.albumId) {
    return listAlbumItems(userId, opts.albumId, opts);
  }
  const tab: GalleryTab = opts.tab ?? "timeline";
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const db = getDb();

  const where: string[] = ["user_id = ?"];
  const params: any[] = [userId];

  if (tab === "trash") {
    where.push("is_deleted = 1");
  } else if (tab === "favorites") {
    where.push("is_deleted = 0");
    where.push("is_favorite = 1");
  } else {
    where.push("is_deleted = 0");
  }

  if (opts.tag) {
    const normalized = normalizeTag(opts.tag);
    if (normalized) {
      where.push("id IN (SELECT item_id FROM gallery_tags WHERE tag = ?)");
      params.push(normalized);
    } else {
      return { items: [], nextCursor: null };
    }
  }

  if (opts.year && Number.isFinite(opts.year)) {
    where.push("strftime('%Y', taken_at) = ?");
    params.push(String(opts.year));
  }

  if (opts.from && /^\d{4}-\d{2}-\d{2}/.test(opts.from)) {
    where.push("taken_at >= ?");
    params.push(`${opts.from.slice(0, 10)}T00:00:00.000Z`);
  }
  if (opts.to && /^\d{4}-\d{2}-\d{2}/.test(opts.to)) {
    where.push("taken_at <= ?");
    params.push(`${opts.to.slice(0, 10)}T23:59:59.999Z`);
  }

  if (opts.minRating && Number.isFinite(opts.minRating) && opts.minRating > 0) {
    where.push("rating >= ?");
    params.push(Math.min(5, Math.max(1, Math.round(opts.minRating))));
  }

  const order = opts.order === "asc" ? "ASC" : "DESC";
  const cmpOp: ">" | "<" = order === "ASC" ? ">" : "<";

  if (opts.cursor) {
    const [ts, idStr] = opts.cursor.split("|");
    if (ts && idStr) {
      where.push(`(taken_at ${cmpOp} ? OR (taken_at = ? AND id ${cmpOp} ?))`);
      params.push(ts, ts, Number(idStr));
    }
  }

  const sql = `
    SELECT *,
           (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gallery_items.id) AS tag_count
      FROM gallery_items
     WHERE ${where.join(" AND ")}
     ORDER BY taken_at ${order}, id ${order}
     LIMIT ?
  `;
  params.push(limit + 1);

  const rows = db.prepare(sql).all(...params) as GalleryItem[];
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const next = rows[limit - 1];
    nextCursor = `${next.taken_at}|${next.id}`;
    rows.length = limit;
  }
  return { items: rows, nextCursor };
}

export function listAlbumItems(
  userId: number,
  albumId: number,
  opts: ListOptions = {},
): ListResult {
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const db = getDb();
  const owns = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!owns) return { items: [], nextCursor: null };

  const where: string[] = ["gi.user_id = ?", "gi.is_deleted = 0", "ai.album_id = ?"];
  const params: any[] = [userId, albumId];

  if (opts.tag) {
    const normalized = normalizeTag(opts.tag);
    if (normalized) {
      where.push("gi.id IN (SELECT item_id FROM gallery_tags WHERE tag = ?)");
      params.push(normalized);
    } else {
      return { items: [], nextCursor: null };
    }
  }
  if (opts.year && Number.isFinite(opts.year)) {
    where.push("strftime('%Y', gi.taken_at) = ?");
    params.push(String(opts.year));
  }
  if (opts.from && /^\d{4}-\d{2}-\d{2}/.test(opts.from)) {
    where.push("gi.taken_at >= ?");
    params.push(`${opts.from.slice(0, 10)}T00:00:00.000Z`);
  }
  if (opts.to && /^\d{4}-\d{2}-\d{2}/.test(opts.to)) {
    where.push("gi.taken_at <= ?");
    params.push(`${opts.to.slice(0, 10)}T23:59:59.999Z`);
  }
  if (opts.minRating && Number.isFinite(opts.minRating) && opts.minRating > 0) {
    where.push("gi.rating >= ?");
    params.push(Math.min(5, Math.max(1, Math.round(opts.minRating))));
  }

  const useCustom = opts.order === "custom";
  const dir = opts.order === "asc" ? "ASC" : "DESC";

  const orderSql = useCustom
    ? "ai.position IS NULL, ai.position ASC, gi.taken_at DESC, gi.id DESC"
    : `gi.taken_at ${dir}, gi.id ${dir}`;

  if (opts.cursor && !useCustom) {
    const cmpOp = dir === "ASC" ? ">" : "<";
    const [ts, idStr] = opts.cursor.split("|");
    if (ts && idStr) {
      where.push(`(gi.taken_at ${cmpOp} ? OR (gi.taken_at = ? AND gi.id ${cmpOp} ?))`);
      params.push(ts, ts, Number(idStr));
    }
  } else if (opts.cursor && useCustom) {
    const [posStr, idStr] = opts.cursor.split("|");
    const pos = parseInt(posStr, 10);
    if (Number.isFinite(pos) && idStr) {
      where.push("(ai.position > ? OR (ai.position = ? AND gi.id > ?))");
      params.push(pos, pos, Number(idStr));
    }
  }

  const sql = `
    SELECT gi.*,
           (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gi.id) AS tag_count,
           ai.position AS __ai_position
      FROM gallery_items gi
      JOIN gallery_album_items ai ON ai.item_id = gi.id
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderSql}
     LIMIT ?
  `;
  params.push(limit + 1);

  const rows = db.prepare(sql).all(...params) as (GalleryItem & {
    __ai_position: number | null;
  })[];

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const next = rows[limit - 1];
    nextCursor = useCustom
      ? `${next.__ai_position ?? 0}|${next.id}`
      : `${next.taken_at}|${next.id}`;
    rows.length = limit;
  }

  for (const r of rows) delete (r as Partial<typeof r>).__ai_position;
  return { items: rows, nextCursor };
}

export function setAlbumItemPositions(
  userId: number,
  albumId: number,
  itemIds: number[],
): { updated: number } {
  const db = getDb();
  const album = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!album) return { updated: 0 };
  const stmt = db.prepare(
    "UPDATE gallery_album_items SET position = ? WHERE album_id = ? AND item_id = ?",
  );
  let updated = 0;
  const tx = db.transaction((ids: number[]) => {
    for (let i = 0; i < ids.length; i++) {
      const r = stmt.run(i + 1, albumId, ids[i]);
      if (r.changes > 0) updated += 1;
    }
  });
  tx(itemIds);
  if (updated > 0) {
    db.prepare(
      "UPDATE gallery_albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(albumId);
  }
  return { updated };
}

export function clearAlbumItemPositions(
  userId: number,
  albumId: number,
): { cleared: number } {
  const db = getDb();
  const album = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!album) return { cleared: 0 };
  const r = db
    .prepare(
      "UPDATE gallery_album_items SET position = NULL WHERE album_id = ?",
    )
    .run(albumId);
  return { cleared: r.changes };
}

export function getItem(userId: number, id: number): GalleryItem | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM gallery_items WHERE id = ? AND user_id = ?")
      .get(id, userId) as GalleryItem | undefined) || null
  );
}

export function getItemForViewing(
  userId: number | null,
  storageKey: string,
): GalleryItem | null {
  const db = getDb();
  if (userId == null) return null;
  return (
    (db
      .prepare("SELECT * FROM gallery_items WHERE storage_key = ? AND user_id = ?")
      .get(storageKey, userId) as GalleryItem | undefined) || null
  );
}

export async function rotateItem(
  userId: number,
  id: number,
  degrees: 90 | 180 | 270,
): Promise<GalleryItem | null> {
  const item = getItem(userId, id);
  if (!item || item.kind !== "image") return null;
  const orig = originalPath(userId, item.storage_key);
  const result = await rotateImageInPlace(orig, degrees);
  if (!result.ok) return null;

  const thumb = thumbPath(userId, item.storage_key);
  const preview = previewPath(userId, item.storage_key);
  await makeImageThumb(orig, thumb, THUMB_MAX, THUMB_QUALITY);
  await makeImageThumb(orig, preview, PREVIEW_MAX, PREVIEW_QUALITY);

  const stat = fs.statSync(orig);
  const db = getDb();
  db.prepare(
    "UPDATE gallery_items SET width = ?, height = ?, size_bytes = ? WHERE id = ? AND user_id = ?",
  ).run(result.width ?? null, result.height ?? null, stat.size, id, userId);
  return getItem(userId, id);
}

// Regenerates thumbnails/previews and stored dimensions for HEIF/HEIC items.
// Items ingested before the libheif-first fix have a single 512px grid tile
// as their thumb/preview (looks extremely zoomed in) and tile dimensions in
// the DB.
export async function repairHeifMedia(userId: number): Promise<{
  scanned: number;
  repaired: number;
  errors: number;
}> {
  const db = getDb();
  const items = db
    .prepare(
      `SELECT id, storage_key FROM gallery_items
        WHERE user_id = ? AND kind = 'image' AND is_deleted = 0
          AND (lower(storage_key) LIKE '%.heif' OR lower(storage_key) LIKE '%.heic'
               OR lower(storage_key) LIKE '%.heifs' OR lower(storage_key) LIKE '%.heics')`,
    )
    .all(userId) as { id: number; storage_key: string }[];

  let repaired = 0;
  let errors = 0;
  for (const it of items) {
    const orig = originalPath(userId, it.storage_key);
    if (!fs.existsSync(orig)) {
      errors += 1;
      continue;
    }
    const jpeg = await heifToJpeg(orig);
    if (!jpeg) {
      errors += 1;
      continue;
    }
    try {
      const probed = await ffprobeMedia(jpeg);
      const thumbOk = await makeImageThumb(
        jpeg,
        thumbPath(userId, it.storage_key),
        THUMB_MAX,
        THUMB_QUALITY,
      );
      const previewOk = await makeImageThumb(
        jpeg,
        previewPath(userId, it.storage_key),
        PREVIEW_MAX,
        PREVIEW_QUALITY,
      );
      db.prepare(
        `UPDATE gallery_items SET width = ?, height = ?,
           thumbnail_ready = ?, preview_ready = ? WHERE id = ? AND user_id = ?`,
      ).run(
        probed.width ?? null,
        probed.height ?? null,
        thumbOk ? 1 : 0,
        previewOk ? 1 : 0,
        it.id,
        userId,
      );
      if (thumbOk && previewOk) repaired += 1;
      else errors += 1;
    } finally {
      try {
        fs.unlinkSync(jpeg);
      } catch {}
    }
  }
  return { scanned: items.length, repaired, errors };
}

export function setTakenAt(
  userId: number,
  id: number,
  iso: string,
): GalleryItem | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const item = getItem(userId, id);
  if (!item) return null;
  const newKey = moveOriginalByDate(userId, item.storage_key, d) ?? item.storage_key;
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE gallery_items SET taken_at = ?, storage_key = ? WHERE id = ? AND user_id = ?",
    )
    .run(d.toISOString(), newKey, id, userId);
  if (result.changes === 0) return null;
  return getItem(userId, id);
}

export function reorganizeFilesByTakenAt(userId: number): {
  scanned: number;
  moved: number;
  errors: number;
} {
  const db = getDb();
  const items = db
    .prepare(
      "SELECT id, storage_key, taken_at FROM gallery_items WHERE user_id = ?",
    )
    .all(userId) as { id: number; storage_key: string; taken_at: string }[];
  let moved = 0;
  let errors = 0;
  for (const it of items) {
    const d = new Date(it.taken_at);
    if (Number.isNaN(d.getTime())) {
      errors += 1;
      continue;
    }
    const parts = it.storage_key.split("/");
    if (parts.length < 3) {
      errors += 1;
      continue;
    }
    const yyyy = String(d.getUTCFullYear());
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    if (parts[0] === yyyy && parts[1] === mm) continue;
    const newKey = moveOriginalByDate(userId, it.storage_key, d);
    if (!newKey || newKey === it.storage_key) {
      errors += 1;
      continue;
    }
    db.prepare("UPDATE gallery_items SET storage_key = ? WHERE id = ?").run(newKey, it.id);
    moved += 1;
  }
  return { scanned: items.length, moved, errors };
}

export function setDescription(
  userId: number,
  id: number,
  value: string | null,
): GalleryItem | null {
  const db = getDb();
  const trimmed = value && value.trim() ? value.trim().slice(0, 2000) : null;
  const result = db
    .prepare("UPDATE gallery_items SET description = ? WHERE id = ? AND user_id = ?")
    .run(trimmed, id, userId);
  if (result.changes === 0) return null;
  return getItem(userId, id);
}

export function setRating(
  userId: number,
  id: number,
  value: number,
): GalleryItem | null {
  const clamped = Math.min(5, Math.max(0, Math.round(value)));
  const db = getDb();
  const result = db
    .prepare("UPDATE gallery_items SET rating = ? WHERE id = ? AND user_id = ?")
    .run(clamped, id, userId);
  if (result.changes === 0) return null;
  return getItem(userId, id);
}

export function setFavorite(userId: number, id: number, value: boolean): GalleryItem | null {
  const db = getDb();
  const result = db
    .prepare("UPDATE gallery_items SET is_favorite = ? WHERE id = ? AND user_id = ?")
    .run(value ? 1 : 0, id, userId);
  if (result.changes === 0) return null;
  return getItem(userId, id);
}

export function softDelete(userId: number, id: number): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE gallery_items SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    )
    .run(id, userId);
  return result.changes > 0;
}

export function restore(userId: number, id: number): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE gallery_items SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND user_id = ?",
    )
    .run(id, userId);
  return result.changes > 0;
}

export function hardDelete(userId: number, id: number): boolean {
  const db = getDb();
  const item = getItem(userId, id);
  if (!item) return false;
  db.prepare("DELETE FROM gallery_items WHERE id = ? AND user_id = ?").run(id, userId);
  deleteFiles(userId, item.storage_key);
  return true;
}

export function purgeOldTrash(userId: number, daysOld: number = 30): number {
  const db = getDb();
  const stmtList = db.prepare(
    `SELECT id, storage_key FROM gallery_items
      WHERE user_id = ?
        AND is_deleted = 1
        AND deleted_at IS NOT NULL
        AND deleted_at < datetime('now', '-' || ? || ' days')`,
  );
  const items = stmtList.all(userId, daysOld) as {
    id: number;
    storage_key: string;
  }[];
  for (const it of items) deleteFiles(userId, it.storage_key);
  const result = db
    .prepare(
      `DELETE FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 1
          AND deleted_at IS NOT NULL
          AND deleted_at < datetime('now', '-' || ? || ' days')`,
    )
    .run(userId, daysOld);
  return result.changes;
}

export function countPurgeableTrash(userId: number, daysOld: number = 30): number {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM gallery_items
          WHERE user_id = ?
            AND is_deleted = 1
            AND deleted_at IS NOT NULL
            AND deleted_at < datetime('now', '-' || ? || ' days')`,
      )
      .get(userId, daysOld) as { c: number }
  ).c;
}

function mergeGalleryItemPair(
  userId: number,
  keeperId: number,
  loserId: number,
): void {
  const db = getDb();
  const loser = db
    .prepare(
      `SELECT id, latitude, longitude, location_name, description, is_favorite
         FROM gallery_items WHERE id = ? AND user_id = ?`,
    )
    .get(loserId, userId) as
    | {
        id: number;
        latitude: number | null;
        longitude: number | null;
        location_name: string | null;
        description: string | null;
        is_favorite: number;
      }
    | undefined;
  if (!loser) return;

  db.prepare(
    `INSERT OR IGNORE INTO gallery_tags (item_id, tag)
     SELECT ?, tag FROM gallery_tags WHERE item_id = ?`,
  ).run(keeperId, loserId);
  db.prepare(`DELETE FROM gallery_tags WHERE item_id = ?`).run(loserId);

  db.prepare(
    `INSERT OR IGNORE INTO gallery_album_items (album_id, item_id)
     SELECT album_id, ? FROM gallery_album_items WHERE item_id = ?`,
  ).run(keeperId, loserId);
  db.prepare(`DELETE FROM gallery_album_items WHERE item_id = ?`).run(loserId);

  db.prepare(
    `INSERT OR IGNORE INTO gallery_trip_items (trip_id, item_id)
     SELECT trip_id, ? FROM gallery_trip_items WHERE item_id = ?`,
  ).run(keeperId, loserId);
  db.prepare(`DELETE FROM gallery_trip_items WHERE item_id = ?`).run(loserId);

  db.prepare(
    `UPDATE gallery_trips SET cover_item_id = ? WHERE user_id = ? AND cover_item_id = ?`,
  ).run(keeperId, userId, loserId);

  db.prepare(
    `UPDATE gallery_items
        SET latitude = COALESCE(latitude, ?),
            longitude = COALESCE(longitude, ?),
            location_name = COALESCE(location_name, ?),
            description = COALESCE(description, ?),
            is_favorite = CASE WHEN is_favorite = 1 OR ? = 1 THEN 1 ELSE 0 END
      WHERE id = ?`,
  ).run(
    loser.latitude,
    loser.longitude,
    loser.location_name,
    loser.description,
    loser.is_favorite ? 1 : 0,
    keeperId,
  );

  db.prepare(
    `UPDATE gallery_items
        SET content_hash = NULL,
            is_deleted = 1,
            deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`,
  ).run(loserId, userId);
}

export function backfillContentHashes(userId: number): {
  scanned: number;
  hashed: number;
  missing: number;
  merged: number;
} {
  const db = getDb();
  const items = db
    .prepare(
      `SELECT id, storage_key FROM gallery_items
        WHERE user_id = ? AND content_hash IS NULL AND is_deleted = 0`,
    )
    .all(userId) as { id: number; storage_key: string }[];

  const findExisting = db.prepare(
    `SELECT id FROM gallery_items
       WHERE user_id = ? AND content_hash = ? AND is_deleted = 0 AND id != ?
       ORDER BY id ASC LIMIT 1`,
  );
  const update = db.prepare(
    `UPDATE gallery_items SET content_hash = ? WHERE id = ?`,
  );

  let hashed = 0;
  let missing = 0;
  let merged = 0;
  for (const it of items) {
    const fp = originalPath(userId, it.storage_key);
    if (!fs.existsSync(fp)) {
      missing++;
      continue;
    }
    let h: string;
    try {
      const buf = fs.readFileSync(fp);
      h = createHash("sha256").update(buf).digest("hex");
    } catch {
      missing++;
      continue;
    }
    const existing = findExisting.get(userId, h, it.id) as
      | { id: number }
      | undefined;
    if (existing) {
      const keeper = Math.min(existing.id, it.id);
      const loser = Math.max(existing.id, it.id);
      mergeGalleryItemPair(userId, keeper, loser);
      if (keeper === it.id) {
        try {
          update.run(h, it.id);
          hashed++;
        } catch {}
      }
      merged++;
      continue;
    }
    try {
      update.run(h, it.id);
      hashed++;
    } catch {}
  }
  return { scanned: items.length, hashed, missing, merged };
}

export function dedupeByContentHash(userId: number): {
  groups: number;
  merged: number;
} {
  const db = getDb();
  const dupHashes = db
    .prepare(
      `SELECT content_hash, COUNT(*) AS n
         FROM gallery_items
        WHERE user_id = ? AND is_deleted = 0 AND content_hash IS NOT NULL
        GROUP BY content_hash
       HAVING n > 1`,
    )
    .all(userId) as { content_hash: string; n: number }[];

  if (dupHashes.length === 0) return { groups: 0, merged: 0 };

  const groupStmt = db.prepare(
    `SELECT id, taken_at, latitude, longitude, location_name, description, is_favorite
       FROM gallery_items
      WHERE user_id = ? AND is_deleted = 0 AND content_hash = ?
      ORDER BY id ASC`,
  );
  const moveTags = db.prepare(
    `INSERT OR IGNORE INTO gallery_tags (item_id, tag)
     SELECT ?, tag FROM gallery_tags WHERE item_id = ?`,
  );
  const dropTags = db.prepare(`DELETE FROM gallery_tags WHERE item_id = ?`);
  const moveAlbums = db.prepare(
    `INSERT OR IGNORE INTO gallery_album_items (album_id, item_id)
     SELECT album_id, ? FROM gallery_album_items WHERE item_id = ?`,
  );
  const dropAlbums = db.prepare(
    `DELETE FROM gallery_album_items WHERE item_id = ?`,
  );
  const moveTripItems = db.prepare(
    `INSERT OR IGNORE INTO gallery_trip_items (trip_id, item_id)
     SELECT trip_id, ? FROM gallery_trip_items WHERE item_id = ?`,
  );
  const dropTripItems = db.prepare(
    `DELETE FROM gallery_trip_items WHERE item_id = ?`,
  );
  const repointTripCover = db.prepare(
    `UPDATE gallery_trips SET cover_item_id = ? WHERE user_id = ? AND cover_item_id = ?`,
  );
  const fillMeta = db.prepare(
    `UPDATE gallery_items
        SET latitude = COALESCE(latitude, ?),
            longitude = COALESCE(longitude, ?),
            location_name = COALESCE(location_name, ?),
            description = COALESCE(description, ?),
            is_favorite = CASE WHEN is_favorite = 1 OR ? = 1 THEN 1 ELSE 0 END
      WHERE id = ?`,
  );
  const softDelete = db.prepare(
    `UPDATE gallery_items
        SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`,
  );

  let merged = 0;
  const tx = db.transaction(() => {
    for (const { content_hash } of dupHashes) {
      const rows = groupStmt.all(userId, content_hash) as {
        id: number;
        taken_at: string;
        latitude: number | null;
        longitude: number | null;
        location_name: string | null;
        description: string | null;
        is_favorite: number;
      }[];
      if (rows.length < 2) continue;
      const keeper = rows[0];
      for (let i = 1; i < rows.length; i++) {
        const dup = rows[i];
        moveTags.run(keeper.id, dup.id);
        dropTags.run(dup.id);
        moveAlbums.run(keeper.id, dup.id);
        dropAlbums.run(dup.id);
        moveTripItems.run(keeper.id, dup.id);
        dropTripItems.run(dup.id);
        repointTripCover.run(keeper.id, userId, dup.id);
        fillMeta.run(
          dup.latitude,
          dup.longitude,
          dup.location_name,
          dup.description,
          dup.is_favorite ? 1 : 0,
          keeper.id,
        );
        softDelete.run(dup.id, userId);
        merged++;
      }
    }
  });
  tx();
  return { groups: dupHashes.length, merged };
}

export function emptyTrash(userId: number): number {
  const db = getDb();
  const items = db
    .prepare("SELECT id, storage_key FROM gallery_items WHERE user_id = ? AND is_deleted = 1")
    .all(userId) as { id: number; storage_key: string }[];
  for (const it of items) deleteFiles(userId, it.storage_key);
  const result = db
    .prepare("DELETE FROM gallery_items WHERE user_id = ? AND is_deleted = 1")
    .run(userId);
  return result.changes;
}

export function listAlbums(userId: number): AlbumWithCounts[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM gallery_album_items ai
                 JOIN gallery_items gi ON gi.id = ai.item_id
                WHERE ai.album_id = a.id AND gi.is_deleted = 0) AS item_count,
              gi.storage_key AS cover_storage_key,
              gi.kind AS cover_kind
         FROM gallery_albums a
         LEFT JOIN gallery_items gi ON gi.id = a.cover_item_id
        WHERE a.user_id = ?
        ORDER BY a.updated_at DESC`,
    )
    .all(userId) as AlbumWithCounts[];
  return rows;
}

export function getAlbum(userId: number, id: number): AlbumWithCounts | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM gallery_album_items ai
                 JOIN gallery_items gi ON gi.id = ai.item_id
                WHERE ai.album_id = a.id AND gi.is_deleted = 0) AS item_count,
              gi.storage_key AS cover_storage_key,
              gi.kind AS cover_kind
         FROM gallery_albums a
         LEFT JOIN gallery_items gi ON gi.id = a.cover_item_id
        WHERE a.id = ? AND a.user_id = ?`,
    )
    .get(id, userId) as AlbumWithCounts | undefined;
  return row || null;
}

export function createAlbum(userId: number, name: string, description: string | null = null): GalleryAlbum {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO gallery_albums (user_id, name, description) VALUES (?, ?, ?)")
    .run(userId, name, description);
  const id = Number(result.lastInsertRowid);
  return db.prepare("SELECT * FROM gallery_albums WHERE id = ?").get(id) as GalleryAlbum;
}

export function updateAlbum(
  userId: number,
  id: number,
  patch: { name?: string; description?: string | null; cover_item_id?: number | null },
): GalleryAlbum | null {
  const db = getDb();
  const fields: string[] = [];
  const params: any[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    params.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    params.push(patch.description);
  }
  if (patch.cover_item_id !== undefined) {
    fields.push("cover_item_id = ?");
    params.push(patch.cover_item_id);
  }
  if (fields.length === 0) return getAlbum(userId, id);
  fields.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id, userId);
  const result = db
    .prepare(`UPDATE gallery_albums SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`)
    .run(...params);
  if (result.changes === 0) return null;
  return getAlbum(userId, id);
}

export function deleteAlbum(userId: number, id: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM gallery_albums WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}

export function addItemsToAlbum(userId: number, albumId: number, itemIds: number[]): number {
  const db = getDb();
  const album = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!album) return 0;
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO gallery_album_items (album_id, item_id) VALUES (?, ?)",
  );
  let added = 0;
  const tx = db.transaction((ids: number[]) => {
    for (const itemId of ids) {
      const owned = db
        .prepare("SELECT id FROM gallery_items WHERE id = ? AND user_id = ?")
        .get(itemId, userId);
      if (!owned) continue;
      const r = stmt.run(albumId, itemId);
      if (r.changes > 0) added += 1;
    }
  });
  tx(itemIds);
  if (added > 0) {
    db.prepare("UPDATE gallery_albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      albumId,
    );
    const cover = db
      .prepare("SELECT cover_item_id FROM gallery_albums WHERE id = ?")
      .get(albumId) as { cover_item_id: number | null } | undefined;
    if (cover && cover.cover_item_id == null) {
      db.prepare("UPDATE gallery_albums SET cover_item_id = ? WHERE id = ?").run(
        itemIds[0],
        albumId,
      );
    }
  }
  return added;
}

export function removeItemsFromAlbum(userId: number, albumId: number, itemIds: number[]): number {
  const db = getDb();
  const album = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!album) return 0;
  let removed = 0;
  const tx = db.transaction((ids: number[]) => {
    const stmt = db.prepare(
      "DELETE FROM gallery_album_items WHERE album_id = ? AND item_id = ?",
    );
    for (const itemId of ids) {
      const r = stmt.run(albumId, itemId);
      if (r.changes > 0) removed += 1;
    }
  });
  tx(itemIds);
  return removed;
}

const TAG_MAX_LENGTH = 64;
const TAG_PATTERN = /^[\p{L}\p{N} _\-]+$/u;

function normalizeTag(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length > TAG_MAX_LENGTH) return null;
  if (!TAG_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function getTagsForItem(userId: number, itemId: number): string[] {
  const db = getDb();
  const owns = db
    .prepare("SELECT id FROM gallery_items WHERE id = ? AND user_id = ?")
    .get(itemId, userId);
  if (!owns) return [];
  const rows = db
    .prepare("SELECT tag FROM gallery_tags WHERE item_id = ? ORDER BY tag ASC")
    .all(itemId) as { tag: string }[];
  return rows.map((r) => r.tag);
}

export function addTagToItem(userId: number, itemId: number, raw: string): string | null {
  const tag = normalizeTag(raw);
  if (!tag) return null;
  const db = getDb();
  const owns = db
    .prepare("SELECT id FROM gallery_items WHERE id = ? AND user_id = ?")
    .get(itemId, userId);
  if (!owns) return null;
  db.prepare(
    "INSERT OR IGNORE INTO gallery_tags (item_id, tag) VALUES (?, ?)",
  ).run(itemId, tag);
  return tag;
}

export function addTagToItems(userId: number, itemIds: number[], raw: string): { tag: string; added: number } | null {
  const tag = normalizeTag(raw);
  if (!tag) return null;
  const db = getDb();
  let added = 0;
  const tx = db.transaction((ids: number[]) => {
    const ownedStmt = db.prepare(
      "SELECT id FROM gallery_items WHERE id = ? AND user_id = ?",
    );
    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO gallery_tags (item_id, tag) VALUES (?, ?)",
    );
    for (const id of ids) {
      if (!ownedStmt.get(id, userId)) continue;
      const r = insertStmt.run(id, tag);
      if (r.changes > 0) added += 1;
    }
  });
  tx(itemIds);
  return { tag, added };
}

export function removeTagFromItem(userId: number, itemId: number, raw: string): boolean {
  const tag = normalizeTag(raw);
  if (!tag) return false;
  const db = getDb();
  const owns = db
    .prepare("SELECT id FROM gallery_items WHERE id = ? AND user_id = ?")
    .get(itemId, userId);
  if (!owns) return false;
  const result = db
    .prepare("DELETE FROM gallery_tags WHERE item_id = ? AND tag = ?")
    .run(itemId, tag);
  return result.changes > 0;
}

export interface TagSummary {
  tag: string;
  count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

export function renameTag(userId: number, oldTag: string, newTag: string): { tag: string; affected: number } | null {
  const oldNorm = normalizeTag(oldTag);
  const newNorm = normalizeTag(newTag);
  if (!oldNorm || !newNorm) return null;
  if (oldNorm === newNorm) return { tag: newNorm, affected: 0 };
  const db = getDb();
  let affected = 0;
  const tx = db.transaction(() => {
    const items = db
      .prepare(
        `SELECT gt.item_id FROM gallery_tags gt
           JOIN gallery_items gi ON gi.id = gt.item_id
          WHERE gi.user_id = ? AND gt.tag = ?`,
      )
      .all(userId, oldNorm) as { item_id: number }[];
    if (items.length === 0) return;
    const insert = db.prepare(
      "INSERT OR IGNORE INTO gallery_tags (item_id, tag) VALUES (?, ?)",
    );
    const remove = db.prepare(
      "DELETE FROM gallery_tags WHERE item_id = ? AND tag = ?",
    );
    for (const { item_id } of items) {
      insert.run(item_id, newNorm);
      remove.run(item_id, oldNorm);
      affected += 1;
    }
  });
  tx();
  return { tag: newNorm, affected };
}

export function deleteTagForUser(userId: number, tag: string): number {
  const norm = normalizeTag(tag);
  if (!norm) return 0;
  const db = getDb();
  const result = db
    .prepare(
      `DELETE FROM gallery_tags
        WHERE tag = ?
          AND item_id IN (SELECT id FROM gallery_items WHERE user_id = ?)`,
    )
    .run(norm, userId);
  return result.changes;
}

export interface GeoItem {
  id: number;
  storage_key: string;
  filename: string;
  kind: MediaKind;
  taken_at: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface Trip {
  id: number;
  start_at: string;
  end_at: string;
  count: number;
  center_lat: number;
  center_lng: number;
  title: string;
  auto_title: string | null;
  has_custom_title: boolean;
  hidden: boolean;
  cover_item_id: number;
  cover_storage_key: string;
  cover_kind: MediaKind;
  has_custom_cover: boolean;
  item_ids: number[];
}

function shortPlace(name: string | null): string | null {
  if (!name) return null;
  const parts = name
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts[0] + ", " + parts[parts.length - 1];
}

function computeTripAutoTitle(
  items: { latitude: number | null; longitude: number | null; location_name: string | null }[],
): string {
  const placeCounts = new Map<string, number>();
  let sumLat = 0;
  let sumLng = 0;
  let geoN = 0;
  for (const it of items) {
    if (it.latitude != null && it.longitude != null) {
      sumLat += it.latitude;
      sumLng += it.longitude;
      geoN++;
    }
    const p = shortPlace(it.location_name);
    if (p) placeCounts.set(p, (placeCounts.get(p) ?? 0) + 1);
  }
  let bestPlace: string | null = null;
  let bestN = 0;
  for (const [p, n] of placeCounts) {
    if (n > bestN) {
      bestN = n;
      bestPlace = p;
    }
  }
  if (bestPlace) return bestPlace;
  if (geoN > 0) {
    return `${(sumLat / geoN).toFixed(2)}, ${(sumLng / geoN).toFixed(2)}`;
  }
  return "Trip";
}

interface TripCandidateItem {
  id: number;
  storage_key: string;
  kind: MediaKind;
  taken_at: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
}

interface TripCluster {
  items: TripCandidateItem[];
  center_lat: number;
  center_lng: number;
  auto_title: string;
}

function detectTripClusters(
  userId: number,
  opts: { gapHours?: number; radiusKm?: number; minItems?: number } = {},
): TripCluster[] {
  const gapMs = (opts.gapHours ?? 36) * 60 * 60 * 1000;
  const radius = opts.radiusKm ?? 30;
  const minItems = opts.minItems ?? 3;

  const db = getDb();
  const items = db
    .prepare(
      `SELECT id, storage_key, kind, taken_at, latitude, longitude, location_name
         FROM gallery_items
        WHERE user_id = ? AND is_deleted = 0
          AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY taken_at ASC, id ASC`,
    )
    .all(userId) as TripCandidateItem[];

  if (items.length === 0) return [];

  interface MutableCluster {
    items: TripCandidateItem[];
    center_lat: number;
    center_lng: number;
    sum_lat: number;
    sum_lng: number;
    last_taken_at_ms: number;
  }

  const clusters: MutableCluster[] = [];
  for (const it of items) {
    const t = new Date(it.taken_at).getTime();
    if (!Number.isFinite(t)) continue;
    const last = clusters[clusters.length - 1];
    if (last) {
      const timeGap = t - last.last_taken_at_ms;
      const dist = haversineKm(
        it.latitude,
        it.longitude,
        last.center_lat,
        last.center_lng,
      );
      if (timeGap <= gapMs && dist <= radius) {
        last.items.push(it);
        last.sum_lat += it.latitude;
        last.sum_lng += it.longitude;
        last.center_lat = last.sum_lat / last.items.length;
        last.center_lng = last.sum_lng / last.items.length;
        last.last_taken_at_ms = t;
        continue;
      }
    }
    clusters.push({
      items: [it],
      center_lat: it.latitude,
      center_lng: it.longitude,
      sum_lat: it.latitude,
      sum_lng: it.longitude,
      last_taken_at_ms: t,
    });
  }

  const out: TripCluster[] = [];
  for (const c of clusters) {
    if (c.items.length < minItems) continue;
    out.push({
      items: c.items,
      center_lat: c.center_lat,
      center_lng: c.center_lng,
      auto_title: computeTripAutoTitle(c.items),
    });
  }

  return out;
}

export function refreshTrips(
  userId: number,
  opts: { gapHours?: number; radiusKm?: number; minItems?: number } = {},
): { created: number } {
  const db = getDb();
  const clusters = detectTripClusters(userId, opts);
  if (clusters.length === 0) return { created: 0 };

  const claimed = new Set<number>(
    (
      db
        .prepare(
          `SELECT gti.item_id AS item_id
             FROM gallery_trip_items gti
             JOIN gallery_trips gt ON gt.id = gti.trip_id
            WHERE gt.user_id = ?`,
        )
        .all(userId) as { item_id: number }[]
    ).map((r) => r.item_id),
  );

  const rules = new Map<string, string>(
    (
      db
        .prepare(
          `SELECT auto_title, title FROM gallery_trip_name_rules WHERE user_id = ?`,
        )
        .all(userId) as { auto_title: string; title: string }[]
    ).map((r) => [r.auto_title, r.title]),
  );

  const insertTrip = db.prepare(
    `INSERT INTO gallery_trips (user_id, title, cover_item_id, hidden)
     VALUES (?, ?, NULL, 0)`,
  );
  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO gallery_trip_items (trip_id, item_id) VALUES (?, ?)`,
  );

  let created = 0;
  const tx = db.transaction(() => {
    for (const c of clusters) {
      const fresh = c.items.filter((i) => !claimed.has(i.id));
      if (fresh.length < c.items.length) continue;
      const ruleTitle = rules.get(c.auto_title) ?? null;
      const info = insertTrip.run(userId, ruleTitle);
      const tripId = Number(info.lastInsertRowid);
      for (const it of c.items) {
        insertMember.run(tripId, it.id);
        claimed.add(it.id);
      }
      created++;
    }
  });
  tx();
  return { created };
}

export function applyTripNameRule(
  userId: number,
  tripId: number,
  rawTitle: string,
): { ok: boolean; affected: number; auto_title: string | null } {
  const cleaned = rawTitle.trim();
  if (cleaned.length === 0) return { ok: false, affected: 0, auto_title: null };

  const db = getDb();
  const trip = db
    .prepare(`SELECT id FROM gallery_trips WHERE id = ? AND user_id = ?`)
    .get(tripId, userId) as { id: number } | undefined;
  if (!trip) return { ok: false, affected: 0, auto_title: null };

  const sourceItems = db
    .prepare(
      `SELECT gi.latitude, gi.longitude, gi.location_name
         FROM gallery_trip_items gti
         JOIN gallery_items gi ON gi.id = gti.item_id
        WHERE gti.trip_id = ? AND gi.is_deleted = 0`,
    )
    .all(tripId) as {
    latitude: number | null;
    longitude: number | null;
    location_name: string | null;
  }[];
  const targetAutoTitle = computeTripAutoTitle(sourceItems);

  const allTrips = db
    .prepare(`SELECT id FROM gallery_trips WHERE user_id = ?`)
    .all(userId) as { id: number }[];

  const memberStmt = db.prepare(
    `SELECT gi.latitude, gi.longitude, gi.location_name
       FROM gallery_trip_items gti
       JOIN gallery_items gi ON gi.id = gti.item_id
      WHERE gti.trip_id = ? AND gi.is_deleted = 0`,
  );
  const updateStmt = db.prepare(
    `UPDATE gallery_trips SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
  );
  const upsertRule = db.prepare(
    `INSERT INTO gallery_trip_name_rules (user_id, auto_title, title)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, auto_title) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP`,
  );

  let affected = 0;
  const tx = db.transaction(() => {
    upsertRule.run(userId, targetAutoTitle, cleaned);
    for (const t of allTrips) {
      const items = memberStmt.all(t.id) as {
        latitude: number | null;
        longitude: number | null;
        location_name: string | null;
      }[];
      if (items.length === 0) continue;
      const at = computeTripAutoTitle(items);
      if (at === targetAutoTitle) {
        updateStmt.run(cleaned, t.id, userId);
        affected++;
      }
    }
  });
  tx();
  return { ok: true, affected, auto_title: targetAutoTitle };
}

export function listTrips(userId: number): Trip[] {
  const db = getDb();
  const trips = db
    .prepare(
      `SELECT id, title, cover_item_id, hidden FROM gallery_trips WHERE user_id = ? ORDER BY id DESC`,
    )
    .all(userId) as {
    id: number;
    title: string | null;
    cover_item_id: number | null;
    hidden: number;
  }[];

  if (trips.length === 0) return [];

  const memberStmt = db.prepare(
    `SELECT gi.id, gi.storage_key, gi.kind, gi.taken_at, gi.latitude, gi.longitude, gi.location_name
       FROM gallery_trip_items gti
       JOIN gallery_items gi ON gi.id = gti.item_id
      WHERE gti.trip_id = ? AND gi.is_deleted = 0
      ORDER BY gi.taken_at ASC, gi.id ASC`,
  );

  const out: Trip[] = [];
  for (const t of trips) {
    const items = memberStmt.all(t.id) as (TripCandidateItem & {
      latitude: number | null;
      longitude: number | null;
    })[];
    if (items.length === 0) continue;

    let sumLat = 0;
    let sumLng = 0;
    let geoN = 0;
    for (const it of items) {
      if (it.latitude != null && it.longitude != null) {
        sumLat += it.latitude;
        sumLng += it.longitude;
        geoN++;
      }
    }
    const centerLat = geoN > 0 ? sumLat / geoN : 0;
    const centerLng = geoN > 0 ? sumLng / geoN : 0;
    const autoTitle = computeTripAutoTitle(items);

    const first = items[0];
    const last = items[items.length - 1];

    let coverItem: (typeof items)[number] = first;
    if (t.cover_item_id != null) {
      const found = items.find((i) => i.id === t.cover_item_id);
      if (found) coverItem = found;
    }

    out.push({
      id: t.id,
      start_at: first.taken_at,
      end_at: last.taken_at,
      count: items.length,
      center_lat: centerLat,
      center_lng: centerLng,
      title: t.title ?? autoTitle,
      auto_title: autoTitle,
      has_custom_title: t.title != null,
      hidden: t.hidden === 1,
      cover_item_id: coverItem.id,
      cover_storage_key: coverItem.storage_key,
      cover_kind: coverItem.kind,
      has_custom_cover: t.cover_item_id != null,
      item_ids: items.map((i) => i.id),
    });
  }

  out.sort((a, b) => {
    if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
    return new Date(b.start_at).getTime() - new Date(a.start_at).getTime();
  });
  return out;
}

export function updateTrip(
  userId: number,
  tripId: number,
  patch: { title?: string | null; cover_item_id?: number | null; hidden?: boolean },
): boolean {
  const db = getDb();
  const trip = db
    .prepare(`SELECT id FROM gallery_trips WHERE id = ? AND user_id = ?`)
    .get(tripId, userId) as { id: number } | undefined;
  if (!trip) return false;

  const fields: string[] = [];
  const values: unknown[] = [];
  if (Object.prototype.hasOwnProperty.call(patch, "title")) {
    const t = patch.title;
    const cleaned = typeof t === "string" ? t.trim() : null;
    fields.push("title = ?");
    values.push(cleaned && cleaned.length > 0 ? cleaned : null);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "cover_item_id")) {
    if (patch.cover_item_id == null) {
      fields.push("cover_item_id = NULL");
    } else {
      const ok = db
        .prepare(
          `SELECT 1 FROM gallery_trip_items WHERE trip_id = ? AND item_id = ?`,
        )
        .get(tripId, patch.cover_item_id);
      if (!ok) return false;
      fields.push("cover_item_id = ?");
      values.push(patch.cover_item_id);
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "hidden")) {
    fields.push("hidden = ?");
    values.push(patch.hidden ? 1 : 0);
  }
  if (fields.length === 0) return true;
  fields.push("updated_at = CURRENT_TIMESTAMP");
  db.prepare(
    `UPDATE gallery_trips SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
  ).run(...values, tripId, userId);
  return true;
}

export function deleteTrip(userId: number, tripId: number): boolean {
  const db = getDb();
  const info = db
    .prepare(`DELETE FROM gallery_trips WHERE id = ? AND user_id = ?`)
    .run(tripId, userId);
  if (info.changes === 0) return false;
  db.prepare(`DELETE FROM gallery_trip_items WHERE trip_id = ?`).run(tripId);
  return true;
}

export function listGeoItems(userId: number): GeoItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, storage_key, filename, kind, taken_at, latitude, longitude, location_name
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        ORDER BY taken_at DESC, id DESC`,
    )
    .all(userId) as GeoItem[];
}

export function listAllTags(userId: number): TagSummary[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT gt.tag AS tag,
              COUNT(*) AS count,
              (SELECT gi2.storage_key
                 FROM gallery_tags gt2
                 JOIN gallery_items gi2 ON gi2.id = gt2.item_id
                WHERE gt2.tag = gt.tag AND gi2.user_id = ? AND gi2.is_deleted = 0
                ORDER BY gi2.taken_at DESC, gi2.id DESC
                LIMIT 1) AS cover_storage_key,
              (SELECT gi2.kind
                 FROM gallery_tags gt2
                 JOIN gallery_items gi2 ON gi2.id = gt2.item_id
                WHERE gt2.tag = gt.tag AND gi2.user_id = ? AND gi2.is_deleted = 0
                ORDER BY gi2.taken_at DESC, gi2.id DESC
                LIMIT 1) AS cover_kind
         FROM gallery_tags gt
         JOIN gallery_items gi ON gi.id = gt.item_id
        WHERE gi.user_id = ? AND gi.is_deleted = 0
        GROUP BY gt.tag
        ORDER BY count DESC, tag ASC`,
    )
    .all(userId, userId, userId) as TagSummary[];
}

export interface GalleryStats {
  total_items: number;
  total_size_bytes: number;
  image_count: number;
  video_count: number;
  trash_count: number;
  trash_size_bytes: number;
  album_count: number;
  oldest_taken_at: string | null;
  newest_taken_at: string | null;
}

export function getGalleryStats(userId: number): GalleryStats {
  const db = getDb();
  const main = db
    .prepare(
      `SELECT COUNT(*) AS total_items,
              COALESCE(SUM(size_bytes), 0) AS total_size_bytes,
              SUM(CASE WHEN kind = 'image' THEN 1 ELSE 0 END) AS image_count,
              SUM(CASE WHEN kind = 'video' THEN 1 ELSE 0 END) AS video_count,
              MIN(taken_at) AS oldest_taken_at,
              MAX(taken_at) AS newest_taken_at
         FROM gallery_items
        WHERE user_id = ? AND is_deleted = 0`,
    )
    .get(userId) as any;
  const trash = db
    .prepare(
      `SELECT COUNT(*) AS trash_count,
              COALESCE(SUM(size_bytes), 0) AS trash_size_bytes
         FROM gallery_items
        WHERE user_id = ? AND is_deleted = 1`,
    )
    .get(userId) as any;
  const albums = db
    .prepare("SELECT COUNT(*) AS c FROM gallery_albums WHERE user_id = ?")
    .get(userId) as { c: number };
  return {
    total_items: main.total_items ?? 0,
    total_size_bytes: main.total_size_bytes ?? 0,
    image_count: main.image_count ?? 0,
    video_count: main.video_count ?? 0,
    trash_count: trash.trash_count ?? 0,
    trash_size_bytes: trash.trash_size_bytes ?? 0,
    album_count: albums.c ?? 0,
    oldest_taken_at: main.oldest_taken_at ?? null,
    newest_taken_at: main.newest_taken_at ?? null,
  };
}

export interface MemoryGroup {
  years_ago: number;
  year: number;
  items: GalleryItem[];
}

export function listMemories(userId: number, opts: { limit?: number } = {}): MemoryGroup[] {
  const db = getDb();
  const perGroup = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const rows = db
    .prepare(
      `SELECT *,
              (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gallery_items.id) AS tag_count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%m-%d', taken_at) = strftime('%m-%d', 'now')
          AND strftime('%Y', taken_at) <> strftime('%Y', 'now')
        ORDER BY taken_at DESC, id DESC`,
    )
    .all(userId) as GalleryItem[];

  const byYear = new Map<number, GalleryItem[]>();
  for (const row of rows) {
    const year = new Date(row.taken_at).getUTCFullYear();
    const arr = byYear.get(year);
    if (arr) arr.push(row);
    else byYear.set(year, [row]);
  }
  const currentYear = new Date().getUTCFullYear();
  return Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year,
      years_ago: currentYear - year,
      items: items.slice(0, perGroup),
    }));
}

export interface SmartAlbumFilters {
  tag?: string;
  year?: number;
  from?: string;
  to?: string;
  minRating?: number;
  tab?: "timeline" | "favorites";
  order?: "asc" | "desc";
}

export interface SmartAlbum {
  id: number;
  user_id: number;
  name: string;
  filters: SmartAlbumFilters;
  created_at: string;
  updated_at: string;
}

export interface SmartAlbumWithCounts extends SmartAlbum {
  item_count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

function normalizeSmartFilters(input: unknown): SmartAlbumFilters {
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: SmartAlbumFilters = {};
  if (typeof obj.tag === "string" && obj.tag.trim()) out.tag = obj.tag.trim();
  if (typeof obj.year === "number" && Number.isFinite(obj.year)) out.year = Math.trunc(obj.year);
  if (typeof obj.from === "string" && /^\d{4}-\d{2}-\d{2}/.test(obj.from)) out.from = obj.from.slice(0, 10);
  if (typeof obj.to === "string" && /^\d{4}-\d{2}-\d{2}/.test(obj.to)) out.to = obj.to.slice(0, 10);
  if (typeof obj.minRating === "number" && obj.minRating >= 1 && obj.minRating <= 5) {
    out.minRating = Math.round(obj.minRating);
  }
  if (obj.tab === "favorites") out.tab = "favorites";
  if (obj.order === "asc" || obj.order === "desc") out.order = obj.order;
  return out;
}

function parseSmartFilters(raw: string): SmartAlbumFilters {
  try {
    return normalizeSmartFilters(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function listSmartAlbums(userId: number): SmartAlbumWithCounts[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, name, filters, created_at, updated_at
         FROM gallery_smart_albums
        WHERE user_id = ?
        ORDER BY updated_at DESC, id DESC`,
    )
    .all(userId) as {
    id: number;
    user_id: number;
    name: string;
    filters: string;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((row) => {
    const filters = parseSmartFilters(row.filters);
    const list = listItems(userId, {
      tab: filters.tab ?? "timeline",
      tag: filters.tag,
      year: filters.year,
      from: filters.from,
      to: filters.to,
      minRating: filters.minRating,
      order: filters.order,
      limit: 1,
    });
    const cover = list.items[0] ?? null;

    let countRow: { c: number };
    {
      const where: string[] = ["user_id = ?", "is_deleted = 0"];
      const params: unknown[] = [userId];
      if (filters.tab === "favorites") where.push("is_favorite = 1");
      if (filters.tag) {
        where.push("id IN (SELECT item_id FROM gallery_tags WHERE tag = ?)");
        params.push(filters.tag);
      }
      if (filters.year) {
        where.push("strftime('%Y', taken_at) = ?");
        params.push(String(filters.year));
      }
      if (filters.from) {
        where.push("taken_at >= ?");
        params.push(`${filters.from}T00:00:00.000Z`);
      }
      if (filters.to) {
        where.push("taken_at <= ?");
        params.push(`${filters.to}T23:59:59.999Z`);
      }
      if (filters.minRating) {
        where.push("rating >= ?");
        params.push(filters.minRating);
      }
      countRow = db
        .prepare(`SELECT COUNT(*) AS c FROM gallery_items WHERE ${where.join(" AND ")}`)
        .get(...params) as { c: number };
    }

    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      filters,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_count: countRow.c,
      cover_storage_key: cover?.storage_key ?? null,
      cover_kind: cover?.kind ?? null,
    };
  });
}

export function getSmartAlbum(userId: number, id: number): SmartAlbum | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, name, filters, created_at, updated_at
         FROM gallery_smart_albums WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as
    | {
        id: number;
        user_id: number;
        name: string;
        filters: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    filters: parseSmartFilters(row.filters),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createSmartAlbum(
  userId: number,
  name: string,
  filters: unknown,
): SmartAlbum {
  const cleaned = name.trim().slice(0, 80);
  if (!cleaned) throw new Error("Name required");
  const normalized = normalizeSmartFilters(filters);
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO gallery_smart_albums (user_id, name, filters) VALUES (?, ?, ?)",
    )
    .run(userId, cleaned, JSON.stringify(normalized));
  const id = Number(result.lastInsertRowid);
  return getSmartAlbum(userId, id)!;
}

export function updateSmartAlbum(
  userId: number,
  id: number,
  patch: { name?: string; filters?: unknown },
): SmartAlbum | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (typeof patch.name === "string") {
    const cleaned = patch.name.trim().slice(0, 80);
    if (!cleaned) return null;
    fields.push("name = ?");
    values.push(cleaned);
  }
  if (patch.filters !== undefined) {
    fields.push("filters = ?");
    values.push(JSON.stringify(normalizeSmartFilters(patch.filters)));
  }
  if (fields.length === 0) return getSmartAlbum(userId, id);
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id, userId);
  const result = db
    .prepare(
      `UPDATE gallery_smart_albums SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    )
    .run(...values);
  if (result.changes === 0) return null;
  return getSmartAlbum(userId, id);
}

export function deleteSmartAlbum(userId: number, id: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM gallery_smart_albums WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}

export interface YearReview {
  year: number;
  total_items: number;
  total_size_bytes: number;
  image_count: number;
  video_count: number;
  favorite_count: number;
  total_video_ms: number;
  monthly: { month: number; count: number }[];
  top_tags: { tag: string; count: number }[];
  top_places: { name: string; count: number }[];
  top_rated: GalleryItem[];
  top_favorites: GalleryItem[];
  first_item: GalleryItem | null;
  last_item: GalleryItem | null;
  trip_count: number;
  cover_storage_key: string | null;
  cover_kind: MediaKind | null;
}

export function getYearInReview(userId: number, year: number): YearReview {
  const db = getDb();
  const yearStr = String(year);

  const summary = db
    .prepare(
      `SELECT COUNT(*) AS total_items,
              COALESCE(SUM(size_bytes), 0) AS total_size_bytes,
              SUM(CASE WHEN kind = 'image' THEN 1 ELSE 0 END) AS image_count,
              SUM(CASE WHEN kind = 'video' THEN 1 ELSE 0 END) AS video_count,
              SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) AS favorite_count,
              COALESCE(SUM(CASE WHEN kind = 'video' THEN duration_ms ELSE 0 END), 0) AS total_video_ms
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?`,
    )
    .get(userId, yearStr) as {
    total_items: number;
    total_size_bytes: number;
    image_count: number;
    video_count: number;
    favorite_count: number;
    total_video_ms: number;
  };

  const monthlyRows = db
    .prepare(
      `SELECT CAST(strftime('%m', taken_at) AS INTEGER) AS month, COUNT(*) AS count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?
        GROUP BY month
        ORDER BY month ASC`,
    )
    .all(userId, yearStr) as { month: number; count: number }[];
  const monthly: { month: number; count: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const found = monthlyRows.find((r) => r.month === m);
    monthly.push({ month: m, count: found ? found.count : 0 });
  }

  const top_tags = db
    .prepare(
      `SELECT gt.tag, COUNT(*) AS count
         FROM gallery_tags gt
         JOIN gallery_items gi ON gi.id = gt.item_id
        WHERE gi.user_id = ?
          AND gi.is_deleted = 0
          AND strftime('%Y', gi.taken_at) = ?
          AND gt.tag != ?
        GROUP BY gt.tag
        ORDER BY count DESC, gt.tag ASC
        LIMIT 12`,
    )
    .all(userId, yearStr, yearStr) as { tag: string; count: number }[];

  const top_places = db
    .prepare(
      `SELECT location_name AS name, COUNT(*) AS count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?
          AND location_name IS NOT NULL
          AND location_name != ''
        GROUP BY location_name
        ORDER BY count DESC, location_name ASC
        LIMIT 8`,
    )
    .all(userId, yearStr) as { name: string; count: number }[];

  const top_rated = db
    .prepare(
      `SELECT *,
              (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gallery_items.id) AS tag_count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?
          AND rating > 0
        ORDER BY rating DESC, taken_at DESC
        LIMIT 12`,
    )
    .all(userId, yearStr) as GalleryItem[];

  const top_favorites = db
    .prepare(
      `SELECT *,
              (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gallery_items.id) AS tag_count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?
          AND is_favorite = 1
        ORDER BY taken_at DESC
        LIMIT 12`,
    )
    .all(userId, yearStr) as GalleryItem[];

  const first_item = (db
    .prepare(
      `SELECT *,
              (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gallery_items.id) AS tag_count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?
        ORDER BY taken_at ASC, id ASC
        LIMIT 1`,
    )
    .get(userId, yearStr) as GalleryItem | undefined) ?? null;

  const last_item = (db
    .prepare(
      `SELECT *,
              (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gallery_items.id) AS tag_count
         FROM gallery_items
        WHERE user_id = ?
          AND is_deleted = 0
          AND strftime('%Y', taken_at) = ?
        ORDER BY taken_at DESC, id DESC
        LIMIT 1`,
    )
    .get(userId, yearStr) as GalleryItem | undefined) ?? null;

  const tripCountRow = db
    .prepare(
      `SELECT COUNT(DISTINCT gt.id) AS c
         FROM gallery_trips gt
         JOIN gallery_trip_items gti ON gti.trip_id = gt.id
         JOIN gallery_items gi ON gi.id = gti.item_id
        WHERE gt.user_id = ?
          AND gi.is_deleted = 0
          AND strftime('%Y', gi.taken_at) = ?`,
    )
    .get(userId, yearStr) as { c: number };

  const cover = top_rated[0] ?? top_favorites[0] ?? first_item;

  return {
    year,
    total_items: summary.total_items ?? 0,
    total_size_bytes: summary.total_size_bytes ?? 0,
    image_count: summary.image_count ?? 0,
    video_count: summary.video_count ?? 0,
    favorite_count: summary.favorite_count ?? 0,
    total_video_ms: summary.total_video_ms ?? 0,
    monthly,
    top_tags,
    top_places,
    top_rated,
    top_favorites,
    first_item,
    last_item,
    trip_count: tripCountRow?.c ?? 0,
    cover_storage_key: cover?.storage_key ?? null,
    cover_kind: cover?.kind ?? null,
  };
}

export interface SearchOptions {
  q: string;
  limit?: number;
}

export function searchItems(userId: number, opts: SearchOptions): GalleryItem[] {
  const db = getDb();
  const q = opts.q.trim();
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT DISTINCT gi.*,
              (SELECT COUNT(*) FROM gallery_tags WHERE item_id = gi.id) AS tag_count
         FROM gallery_items gi
         LEFT JOIN gallery_tags gt ON gt.item_id = gi.id
        WHERE gi.user_id = ? AND gi.is_deleted = 0
          AND (gi.filename LIKE ? OR gt.tag LIKE ? OR gi.taken_at LIKE ?)
        ORDER BY gi.taken_at DESC
        LIMIT ?`,
    )
    .all(userId, like, like, like, limit) as GalleryItem[];
  return rows;
}

export function getOrCreateAlbumShare(
  userId: number,
  albumId: number,
): { token: string } | null {
  const db = getDb();
  const album = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!album) return null;
  const existing = db
    .prepare("SELECT share_token FROM gallery_album_shares WHERE album_id = ?")
    .get(albumId) as { share_token: string } | undefined;
  if (existing) return { token: existing.share_token };
  const token = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO gallery_album_shares (album_id, share_token) VALUES (?, ?)",
  ).run(albumId, token);
  return { token };
}

export function revokeAlbumShare(userId: number, albumId: number): boolean {
  const db = getDb();
  const album = db
    .prepare("SELECT id FROM gallery_albums WHERE id = ? AND user_id = ?")
    .get(albumId, userId);
  if (!album) return false;
  const result = db
    .prepare("DELETE FROM gallery_album_shares WHERE album_id = ?")
    .run(albumId);
  return result.changes > 0;
}

export interface SharedAlbumView {
  album: GalleryAlbum & { owner_username: string };
  items: GalleryItem[];
}

export function getSharedAlbumByToken(token: string): SharedAlbumView | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT a.*, u.username AS owner_username
         FROM gallery_album_shares s
         JOIN gallery_albums a ON a.id = s.album_id
         JOIN users u ON u.id = a.user_id
        WHERE s.share_token = ?
          AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)`,
    )
    .get(token) as (GalleryAlbum & { owner_username: string }) | undefined;
  if (!row) return null;
  const items = db
    .prepare(
      `SELECT gi.* FROM gallery_album_items ai
         JOIN gallery_items gi ON gi.id = ai.item_id
        WHERE ai.album_id = ? AND gi.is_deleted = 0
        ORDER BY gi.taken_at DESC, gi.id DESC`,
    )
    .all(row.id) as GalleryItem[];
  return { album: row, items };
}

export function getFilePath(item: GalleryItem, variant: "original" | "thumb" | "preview"): string {
  if (variant === "original") return originalPath(item.user_id, item.storage_key);
  if (variant === "thumb") return thumbPath(item.user_id, item.storage_key);
  return previewPath(item.user_id, item.storage_key);
}

export interface ItemShare {
  token: string;
  itemId: number;
}

export function getOrCreateItemShare(
  userId: number,
  itemId: number,
): ItemShare | null {
  const db = getDb();
  const item = db
    .prepare(
      "SELECT id FROM gallery_items WHERE id = ? AND user_id = ? AND is_deleted = 0",
    )
    .get(itemId, userId);
  if (!item) return null;
  const existing = db
    .prepare(
      "SELECT share_token FROM gallery_item_shares WHERE item_id = ? AND created_by = ?",
    )
    .get(itemId, userId) as { share_token: string } | undefined;
  if (existing) return { token: existing.share_token, itemId };
  const token = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO gallery_item_shares (item_id, share_token, created_by) VALUES (?, ?, ?)",
  ).run(itemId, token, userId);
  return { token, itemId };
}

export interface SharedItemView {
  item: GalleryItem;
  ownerUsername: string;
}

export function getItemBySharedToken(token: string): SharedItemView | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT gi.*, u.username AS owner_username
         FROM gallery_item_shares s
         JOIN gallery_items gi ON gi.id = s.item_id
         JOIN users u          ON u.id  = gi.user_id
        WHERE s.share_token = ? AND gi.is_deleted = 0`,
    )
    .get(token) as (GalleryItem & { owner_username: string }) | undefined;
  if (!row) return null;
  const { owner_username, ...item } = row;
  return { item: item as GalleryItem, ownerUsername: owner_username };
}
