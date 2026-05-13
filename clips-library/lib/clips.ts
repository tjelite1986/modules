import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export { encodeSlugForUrl, decodeSlugFromUrl } from "./clipSlugs";

export const CLIPS_ROOT = process.env.CLIPS_ROOT || "/store/shortvideos";

const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v"] as const;
const POSTER_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
const WEB_SUFFIX = ".web.mp4";

// Charset for an individual path segment (basename or profile folder name).
const SEGMENT_RE = /^[A-Za-z0-9 ._\-()]+$/;

function isTranscodedVariant(filename: string): boolean {
  return filename.toLowerCase().endsWith(WEB_SUFFIX);
}

// If <slug>.web.mp4 exists alongside the original, prefer it: it's been
// re-encoded for the web player (faststart, capped bitrate, lower decoder
// load). Returns { file, mtime, kind } for whichever file should be served;
// `kind` lets the caller tell whether the user is about to stream the
// transcoded variant or the (possibly unplayable) original.
function resolveServedVideo(
  dir: string,
  basename: string,
  originalExt: string,
): { file: string; mtime: number; kind: "web" | "original" } | null {
  const web = path.join(dir, `${basename}${WEB_SUFFIX}`);
  if (fs.existsSync(web)) {
    const stat = fs.statSync(web);
    return { file: web, mtime: stat.mtimeMs, kind: "web" };
  }
  const original = path.join(dir, `${basename}.${originalExt}`);
  if (fs.existsSync(original)) {
    const stat = fs.statSync(original);
    return { file: original, mtime: stat.mtimeMs, kind: "original" };
  }
  return null;
}

export type TranscodeStatus = "ready" | "pending" | "failed";

function transcodeStatusFor(
  dir: string,
  basename: string,
  servedKind: "web" | "original",
): TranscodeStatus {
  if (servedKind === "web") return "ready";
  // Original is being served. Check whether the transcoder has already
  // given up on it (`.web.failed` marker) or whether it's still queued.
  return fs.existsSync(path.join(dir, `${basename}.web.failed`)) ? "failed" : "pending";
}

export interface ClipMeta {
  title?: string;
  description?: string;
  uploader?: string;
  tags?: string[];
  url?: string;
}

export interface Clip {
  /** Internal slug — `<profile>/<basename>` for files in a profile folder, or `<basename>` for legacy flat files. */
  slug: string;
  /** Profile folder name if the clip lives in `<root>/<profile>/`, otherwise null. */
  profile: string | null;
  /** Top-level category folder when the library is organised by category (currently shorts18). null for flat libraries. */
  category: string | null;
  videoExt: string;
  videoMtime: number;
  videoSize: number;
  posterExt: string | null;
  posterMtime: number;
  /** "ready" = serving `.web.mp4`; "pending" = still serving the raw original (transcoder hasn't run yet or is queued); "failed" = original couldn't be transcoded. */
  transcodeStatus: TranscodeStatus;
  meta: ClipMeta;
}

/** Categories used by the shorts18 library. The migration places every existing video into `uncategorized` until a user assigns one. */
export const SHORTS18_CATEGORIES = [
  "uncategorized",
  "straight",
  "gay",
  "lesbian",
  "trans",
] as const;
export type Shorts18Category = (typeof SHORTS18_CATEGORIES)[number];

export function isValidShorts18Category(s: string): s is Shorts18Category {
  return (SHORTS18_CATEGORIES as readonly string[]).includes(s);
}

/** Slug = optional `<profile>/` prefix + basename. Both segments use SEGMENT_RE. */
export function isValidSlug(s: string): boolean {
  if (s.includes("..")) return false;
  const parts = s.split("/");
  if (parts.length > 2) return false;
  for (const part of parts) {
    if (!part || !SEGMENT_RE.test(part)) return false;
  }
  return true;
}

export function isValidProfile(name: string): boolean {
  return SEGMENT_RE.test(name) && !name.includes("..");
}

function readMetaFor(dir: string, basename: string): ClipMeta {
  const mdPath = path.join(dir, `${basename}.md`);
  if (!fs.existsSync(mdPath)) return {};
  try {
    const raw = fs.readFileSync(mdPath, "utf-8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const description =
      typeof data.description === "string"
        ? data.description
        : parsed.content.trim() || undefined;
    return {
      title: typeof data.title === "string" ? data.title : undefined,
      description,
      uploader: typeof data.uploader === "string" ? data.uploader : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
      url: typeof data.url === "string" ? data.url : undefined,
    };
  } catch {
    return {};
  }
}

function findExt(dir: string, basename: string, exts: readonly string[]): string | null {
  for (const ext of exts) {
    if (fs.existsSync(path.join(dir, `${basename}.${ext}`))) return ext;
  }
  return null;
}

function buildClip(
  dir: string,
  basename: string,
  profile: string | null,
  category: string | null,
  served: { file: string; mtime: number; kind: "web" | "original" },
  originalExt: string,
): Clip {
  const stat = fs.statSync(served.file);
  const posterExt = findExt(dir, basename, POSTER_EXTS);
  const posterMtime = posterExt
    ? fs.statSync(path.join(dir, `${basename}.${posterExt}`)).mtimeMs
    : 0;
  const meta = readMetaFor(dir, basename);
  // If no explicit uploader in the .md, default to the profile folder name.
  if (!meta.uploader && profile) meta.uploader = profile;
  const slug = profile ? `${profile}/${basename}` : basename;
  return {
    slug,
    profile,
    category,
    videoExt: originalExt,
    videoMtime: served.mtime,
    videoSize: stat.size,
    posterExt,
    posterMtime,
    transcodeStatus: transcodeStatusFor(dir, basename, served.kind),
    meta,
  };
}

/**
 * Scan one directory (a library root or a profile folder) for clip files.
 * Each `<basename>.<ext>` is one clip; sidecar `<basename>.md` and
 * `<basename>.<jpg|png|...>` are metadata + poster.
 */
function scanDir(dir: string, profile: string | null, category: string | null): Clip[] {
  if (!fs.existsSync(dir)) return [];
  const out: Clip[] = [];
  const seen = new Set<string>();
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Pass 1: clips with an original source file.
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    if (isTranscodedVariant(entry.name)) continue;
    const dot = entry.name.lastIndexOf(".");
    if (dot < 0) continue;
    const basename = entry.name.slice(0, dot);
    const ext = entry.name.slice(dot + 1).toLowerCase();
    if (!(VIDEO_EXTS as readonly string[]).includes(ext)) continue;
    if (!SEGMENT_RE.test(basename)) continue;
    if (seen.has(basename)) continue;
    const served = resolveServedVideo(dir, basename, ext);
    if (!served) continue;
    seen.add(basename);
    out.push(buildClip(dir, basename, profile, category, served, ext));
  }

  // Pass 2: orphan <basename>.web.mp4 files (original was deleted to save space).
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    if (!isTranscodedVariant(entry.name)) continue;
    const basename = entry.name.slice(0, -WEB_SUFFIX.length);
    if (!SEGMENT_RE.test(basename)) continue;
    if (seen.has(basename)) continue;
    const file = path.join(dir, entry.name);
    const stat = fs.statSync(file);
    seen.add(basename);
    out.push(buildClip(dir, basename, profile, category, { file, mtime: stat.mtimeMs, kind: "web" }, "mp4"));
  }

  return out;
}

export interface ListClipsOpts {
  /** Restrict to a single profile (when categorized, the profile may appear under several category folders — all of them are scanned). */
  profileFilter?: string;
  /** When true, the layout is `<root>/<category>/<profile>/<basename>` instead of `<root>/<profile>/<basename>`. */
  categorized?: boolean;
}

/**
 * List all clips in a library root.
 *
 * Default layout: legacy flat files at the top level plus per-profile clips
 * one folder deep (`<root>/<profile>/<basename>`).
 *
 * Categorized layout (`opts.categorized = true`): two folders deep,
 * `<root>/<category>/<profile>/<basename>`. The category name is exposed as
 * `clip.category`; the slug stays `<profile>/<basename>` so existing
 * engagement rows (likes/views/comments keyed by slug) survive moves
 * between categories.
 */
export function listClips(
  root: string = CLIPS_ROOT,
  opts: ListClipsOpts | string = {},
): Clip[] {
  // Back-compat: callers used to pass a profileFilter string as the 2nd arg.
  const o: ListClipsOpts = typeof opts === "string" ? { profileFilter: opts } : opts;
  if (!fs.existsSync(root)) return [];
  const out: Clip[] = [];

  if (o.categorized) {
    const categoryEntries = fs.readdirSync(root, { withFileTypes: true });
    for (const catEntry of categoryEntries) {
      if (!catEntry.isDirectory() && !catEntry.isSymbolicLink()) continue;
      if (catEntry.name.startsWith(".") || catEntry.name.startsWith("_")) continue;
      if (!isValidProfile(catEntry.name)) continue;
      const catDir = path.join(root, catEntry.name);
      const category = catEntry.name;
      const profileEntries = fs.readdirSync(catDir, { withFileTypes: true });
      for (const profEntry of profileEntries) {
        if (!profEntry.isDirectory() && !profEntry.isSymbolicLink()) continue;
        if (profEntry.name.startsWith(".") || profEntry.name.startsWith("_")) continue;
        if (!isValidProfile(profEntry.name)) continue;
        if (o.profileFilter && profEntry.name !== o.profileFilter) continue;
        out.push(...scanDir(path.join(catDir, profEntry.name), profEntry.name, category));
      }
    }
    out.sort((a, b) => b.videoMtime - a.videoMtime);
    return out;
  }

  if (!o.profileFilter) {
    out.push(...scanDir(root, null, null));
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (!isValidProfile(entry.name)) continue;
    const subDir = path.join(root, entry.name);
    if (entry.isSymbolicLink() && !fs.statSync(subDir).isDirectory()) continue;
    if (o.profileFilter && entry.name !== o.profileFilter) continue;
    out.push(...scanDir(subDir, entry.name, null));
  }

  out.sort((a, b) => b.videoMtime - a.videoMtime);
  return out;
}

export interface ProfileSummary {
  profile: string;
  count: number;
  lastMtime: number;
  /** Slug of the most-recent clip — used to render a thumbnail on the profile card. */
  sampleSlug: string | null;
  sampleHasPoster: boolean;
  samplePosterMtime: number;
  sampleVideoMtime: number;
}

/**
 * Build per-profile summaries from a single scan of the library root.
 * Sorted by recency of the latest clip.
 */
export function listProfileSummaries(
  root: string = CLIPS_ROOT,
  opts: { categorized?: boolean } = {},
): ProfileSummary[] {
  const map = new Map<string, ProfileSummary>();
  for (const c of listClips(root, { categorized: opts.categorized })) {
    if (!c.profile) continue;
    let cur = map.get(c.profile);
    if (!cur) {
      cur = {
        profile: c.profile,
        count: 0,
        lastMtime: 0,
        sampleSlug: null,
        sampleHasPoster: false,
        samplePosterMtime: 0,
        sampleVideoMtime: 0,
      };
      map.set(c.profile, cur);
    }
    cur.count++;
    if (c.videoMtime > cur.lastMtime) {
      cur.lastMtime = c.videoMtime;
      cur.sampleSlug = c.slug;
      cur.sampleHasPoster = c.posterExt !== null;
      cur.samplePosterMtime = c.posterMtime;
      cur.sampleVideoMtime = c.videoMtime;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastMtime - a.lastMtime);
}

/** List the names of profile folders under a library root. */
export function listProfiles(
  root: string = CLIPS_ROOT,
  opts: { categorized?: boolean } = {},
): string[] {
  if (!fs.existsSync(root)) return [];
  const out = new Set<string>();
  const enumerate = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      if (!isValidProfile(entry.name)) continue;
      if (entry.isSymbolicLink() && !fs.statSync(path.join(dir, entry.name)).isDirectory()) continue;
      out.add(entry.name);
    }
  };
  if (opts.categorized) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      enumerate(path.join(root, entry.name));
    }
  } else {
    enumerate(root);
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function splitSlug(slug: string): { profile: string | null; basename: string } | null {
  if (!isValidSlug(slug)) return null;
  const idx = slug.indexOf("/");
  if (idx < 0) return { profile: null, basename: slug };
  return { profile: slug.slice(0, idx), basename: slug.slice(idx + 1) };
}

function dirForProfile(root: string, profile: string | null): string {
  return profile ? path.join(root, profile) : root;
}

/**
 * Resolve the directory that contains `<basename>.<ext>` (or the orphan
 * `.web.mp4`) for a given slug, trying the flat layout first, then any
 * top-level category subfolder. Returns the resolved directory plus the
 * detected category (null for flat layouts).
 */
function resolveClipDir(
  slug: string,
  root: string,
): { dir: string; profile: string | null; basename: string; category: string | null } | null {
  const parts = splitSlug(slug);
  if (!parts) return null;
  if (parts.profile === null) {
    if (!fs.existsSync(root)) return null;
    return { dir: root, profile: null, basename: parts.basename, category: null };
  }
  // 1. Try flat layout `<root>/<profile>/`.
  const flatDir = path.join(root, parts.profile);
  if (fs.existsSync(flatDir) && hasClipFiles(flatDir, parts.basename)) {
    return { dir: flatDir, profile: parts.profile, basename: parts.basename, category: null };
  }
  // 2. Try categorized layout `<root>/<category>/<profile>/`.
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (!isValidProfile(entry.name)) continue;
    const nestedDir = path.join(root, entry.name, parts.profile);
    if (!fs.existsSync(nestedDir)) continue;
    if (hasClipFiles(nestedDir, parts.basename)) {
      return {
        dir: nestedDir,
        profile: parts.profile,
        basename: parts.basename,
        category: entry.name,
      };
    }
  }
  return null;
}

function hasClipFiles(dir: string, basename: string): boolean {
  for (const ext of VIDEO_EXTS) {
    if (fs.existsSync(path.join(dir, `${basename}.${ext}`))) return true;
  }
  return fs.existsSync(path.join(dir, `${basename}${WEB_SUFFIX}`));
}

export function findClip(slug: string, root: string = CLIPS_ROOT): Clip | null {
  const resolved = resolveClipDir(slug, root);
  if (!resolved) return null;
  const { dir, profile, basename, category } = resolved;

  for (const ext of VIDEO_EXTS) {
    const original = path.join(dir, `${basename}.${ext}`);
    if (!fs.existsSync(original)) continue;
    const served = resolveServedVideo(dir, basename, ext);
    if (!served) continue;
    return buildClip(dir, basename, profile, category, served, ext);
  }
  // No original — fall back to orphan <basename>.web.mp4.
  const web = path.join(dir, `${basename}${WEB_SUFFIX}`);
  if (fs.existsSync(web)) {
    const stat = fs.statSync(web);
    return buildClip(dir, basename, profile, category, { file: web, mtime: stat.mtimeMs, kind: "web" }, "mp4");
  }
  return null;
}

export function videoFilePath(slug: string, ext: string, root: string = CLIPS_ROOT): string | null {
  if (!(VIDEO_EXTS as readonly string[]).includes(ext)) return null;
  const resolved = resolveClipDir(slug, root);
  if (!resolved) return null;
  const served = resolveServedVideo(resolved.dir, resolved.basename, ext);
  if (served) return served.file;
  const web = path.join(resolved.dir, `${resolved.basename}${WEB_SUFFIX}`);
  return fs.existsSync(web) ? web : null;
}

export function posterFilePath(slug: string, root: string = CLIPS_ROOT): { file: string; ext: string } | null {
  const resolved = resolveClipDir(slug, root);
  if (!resolved) return null;
  const ext = findExt(resolved.dir, resolved.basename, POSTER_EXTS);
  if (!ext) return null;
  return { file: path.join(resolved.dir, `${resolved.basename}.${ext}`), ext };
}

/**
 * Write a custom title to the clip's `.md` sidecar (creating the file if it
 * doesn't exist). The sidecar uses simple `key: "value"` YAML — we keep the
 * existing description/uploader/tags/url and only patch the title line.
 * Used by `/api/{clips,shorts18}/[slug]/title`.
 */
export function setClipTitle(
  slug: string,
  title: string,
  root: string = CLIPS_ROOT,
): boolean {
  const resolved = resolveClipDir(slug, root);
  if (!resolved) return false;
  const mdPath = path.join(resolved.dir, `${resolved.basename}.md`);
  const existing = readMetaFor(resolved.dir, resolved.basename);
  const next: ClipMeta = { ...existing, title: title.trim() };
  // Write back as front-matter style. gray-matter parses both with-frontmatter
  // and bare-body files, but we always write a frontmatter block for consistency.
  const frontmatter: Record<string, unknown> = {};
  if (next.title) frontmatter.title = next.title;
  if (next.description) frontmatter.description = next.description;
  if (next.uploader) frontmatter.uploader = next.uploader;
  if (next.tags && next.tags.length > 0) frontmatter.tags = next.tags;
  if (next.url) frontmatter.url = next.url;
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((x) => `  - ${JSON.stringify(String(x))}`).join("\n")}`;
      }
      return `${k}: ${JSON.stringify(String(v))}`;
    })
    .join("\n");
  fs.writeFileSync(mdPath, `---\n${yaml}\n---\n`);
  return true;
}

/**
 * Atomically move a clip and all its sidecars (.web.mp4, .md, poster, .web.failed)
 * to a different category folder under the same root. Returns the new category.
 * Used by `/api/shorts18/[slug]/category`.
 */
export function moveClipToCategory(
  slug: string,
  newCategory: string,
  root: string = CLIPS_ROOT,
): { category: string } | null {
  const resolved = resolveClipDir(slug, root);
  if (!resolved) return null;
  if (!resolved.profile) return null;
  if (resolved.category === newCategory) return { category: newCategory };
  if (!isValidProfile(newCategory)) return null;
  const destDir = path.join(root, newCategory, resolved.profile);
  fs.mkdirSync(destDir, { recursive: true });

  const candidates: string[] = [];
  for (const ext of VIDEO_EXTS) candidates.push(`${resolved.basename}.${ext}`);
  candidates.push(`${resolved.basename}${WEB_SUFFIX}`);
  candidates.push(`${resolved.basename}.web.failed`);
  candidates.push(`${resolved.basename}.md`);
  for (const ext of POSTER_EXTS) candidates.push(`${resolved.basename}.${ext}`);

  for (const name of candidates) {
    const src = path.join(resolved.dir, name);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(destDir, name);
    fs.renameSync(src, dst);
  }

  // Try to clean up empty source dirs (profile folder + its parent category
  // folder) so we don't keep around stale uncategorized/profile shells.
  tryRmdir(resolved.dir);
  if (resolved.category) tryRmdir(path.join(root, resolved.category));

  return { category: newCategory };
}

function tryRmdir(dir: string): void {
  try {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) fs.rmdirSync(dir);
  } catch {
    /* ignore */
  }
}

/**
 * Move every clip belonging to `profile` (across whatever category folders
 * it currently lives in) into `newCategory`. Returns the number of clips
 * moved. Used by `/api/shorts18/bulk-category`.
 */
export function moveProfileToCategory(
  profile: string,
  newCategory: string,
  root: string = CLIPS_ROOT,
): { moved: number; slugs: string[] } {
  if (!isValidProfile(newCategory)) return { moved: 0, slugs: [] };
  const clips = listClips(root, { profileFilter: profile, categorized: true });
  let moved = 0;
  const slugs: string[] = [];
  for (const c of clips) {
    if (c.category === newCategory) continue;
    const result = moveClipToCategory(c.slug, newCategory, root);
    if (result) {
      moved++;
      slugs.push(c.slug);
    }
  }
  return { moved, slugs };
}

/**
 * Move many clips by slug list to the same category in one call.
 */
export function moveSlugsToCategory(
  slugs: string[],
  newCategory: string,
  root: string = CLIPS_ROOT,
): { moved: number; slugs: string[] } {
  if (!isValidProfile(newCategory)) return { moved: 0, slugs: [] };
  let moved = 0;
  const movedSlugs: string[] = [];
  for (const slug of slugs) {
    const result = moveClipToCategory(slug, newCategory, root);
    if (result) {
      moved++;
      movedSlugs.push(slug);
    }
  }
  return { moved, slugs: movedSlugs };
}

export function videoMime(ext: string): string {
  switch (ext) {
    case "webm":
      return "video/webm";
    case "mov":
    case "m4v":
      return "video/mp4";
    default:
      return "video/mp4";
  }
}

export function posterMime(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}
