import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const STORE_ROOT = process.env.STORE_ROOT || path.join(process.cwd(), "store");
export const TYPES = ["apps", "games"] as const;
export type AppType = (typeof TYPES)[number];

export type Arch = "arm64" | "arm32" | "x86_64" | "x86" | "universal";

export type AppFile = {
  name: string;
  size: number;
  arch: Arch;
  versionDir: string;
};

export type AppVersion = {
  version: string;
  files: AppFile[];
  primaryFile: AppFile | null;
  totalSize: number;
  mtime: number;
};

export type AppMeta = {
  name: string;
  developer?: string;
  category?: string;
  tagline?: string;
  description?: string;
  tags?: string[];
  website?: string;
  body?: string;
};

export type AppEntry = {
  type: AppType;
  slug: string;
  hasAssets: boolean;
  hasInfo: boolean;
  hasLogo: boolean;
  hasBanner: boolean;
  meta: AppMeta;
  versions: AppVersion[];
  latest?: AppVersion;
  screenshots: string[];
  updatedAt: number;
};

const VERSION_DIR_RE = /^[0-9][0-9A-Za-z._-]*$/;
const APK_EXT_RE = /\.(apk|xapk|apks|obb|zip)$/i;

/** Strict pattern – used for filenames we control (logo.png, info.md, etc). */
function safeName(s: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(s);
}

/**
 * Looser pattern for downloadable APK/OBB filenames. Same character set as
 * `isValidSlug` (allows spaces, parens, etc.) but forbids path separators.
 */
export function isValidFileName(s: string): boolean {
  if (!s || s.length > 200) return false;
  if (s === "." || s === "..") return false;
  if (s.startsWith(".")) return false;
  if (s.includes("/") || s.includes("\\") || s.includes("\0")) return false;
  if (s.includes("..")) return false;
  if (/[\x00-\x1f]/.test(s)) return false;
  return /^[\p{L}\p{N} ._\-()[\]{}+&!',]+$/u.test(s);
}

/** Detect Android architecture from APK filename. */
export function detectArch(name: string): Arch {
  const n = name.toLowerCase();
  if (/arm64[-_]?v8a|arm64|arm[-_]?v?8|aarch64/.test(n)) return "arm64";
  if (/armeabi[-_]?v7a|arm[-_]?v?7|armv7|arm32/.test(n)) return "arm32";
  if (/x86[_-]?64/.test(n)) return "x86_64";
  if (/[-_.]x86([-_.]|$)/.test(n)) return "x86";
  return "universal";
}

export const ARCH_LABELS: Record<Arch, string> = {
  arm64: "ARM 8",
  arm32: "ARM 7",
  x86_64: "x86_64",
  x86: "x86",
  universal: "Universal",
};

/**
 * Looser pattern for app/game folder names. Allows letters, digits, spaces,
 * `._-` and `(){}+&!',[]` so users can name folders like "Instagram (InstaGold)".
 * Forbids path separators, control chars, leading dot, and the `..` sequence.
 */
export function isValidSlug(s: string): boolean {
  if (!s || s.length > 120) return false;
  if (s === "." || s === "..") return false;
  if (s.startsWith(".")) return false;
  if (s.includes("/") || s.includes("\\") || s.includes("\0")) return false;
  if (s.includes("..")) return false;
  if (/[\x00-\x1f]/.test(s)) return false;
  return /^[\p{L}\p{N} ._\-()[\]{}+&!',]+$/u.test(s);
}

export function appDir(type: AppType, slug: string): string {
  if (!TYPES.includes(type)) throw new Error("invalid type");
  if (!isValidSlug(slug)) throw new Error("invalid slug");
  return path.join(STORE_ROOT, type, slug);
}

export function assetsDir(type: AppType, slug: string): string {
  return path.join(appDir(type, slug), "assets");
}

export function infoFile(type: AppType, slug: string): string {
  return path.join(assetsDir(type, slug), "info.md");
}

function logoCandidates(type: AppType, slug: string): string[] {
  const base = assetsDir(type, slug);
  return ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp", "icon.png"].map((n) =>
    path.join(base, n),
  );
}

export function findLogo(type: AppType, slug: string): string | null {
  for (const c of logoCandidates(type, slug)) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function bannerCandidates(type: AppType, slug: string): string[] {
  const base = assetsDir(type, slug);
  return ["banner.png", "banner.jpg", "banner.jpeg", "banner.webp", "feature.png"].map((n) =>
    path.join(base, n),
  );
}

export function findBanner(type: AppType, slug: string): string | null {
  for (const c of bannerCandidates(type, slug)) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const ARCH_SUFFIX_RE = /[._-](arm64-?v8a|arm64|armv?8|arm8|armeabi-?v7a|armv?7|arm7|arm32|aarch64|x86[_-]?64|x86|universal)$/i;

function splitVersionDir(name: string): { base: string; arch: Arch | null } {
  const m = name.match(ARCH_SUFFIX_RE);
  if (!m) return { base: name, arch: null };
  return { base: name.slice(0, -m[0].length), arch: detectArch(m[1]) };
}

function readVersions(dir: string): AppVersion[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const groups = new Map<
    string,
    { files: AppFile[]; total: number; mtime: number; primary: AppFile | null }
  >();
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === "assets") continue;
    if (!VERSION_DIR_RE.test(e.name)) continue;
    const { base, arch: dirArch } = splitVersionDir(e.name);
    const versionDir = path.join(dir, e.name);
    const subEntries = fs.readdirSync(versionDir, { withFileTypes: true });
    let g = groups.get(base);
    if (!g) {
      g = { files: [], total: 0, mtime: 0, primary: null };
      groups.set(base, g);
    }
    for (const f of subEntries) {
      if (!f.isFile()) continue;
      const fp = path.join(versionDir, f.name);
      const st = fs.statSync(fp);
      const fileArch = detectArch(f.name);
      const arch: Arch =
        fileArch !== "universal" ? fileArch : dirArch ?? "universal";
      const file: AppFile = { name: f.name, size: st.size, arch, versionDir: e.name };
      g.files.push(file);
      g.total += st.size;
      if (st.mtimeMs > g.mtime) g.mtime = st.mtimeMs;
      if (!g.primary && APK_EXT_RE.test(f.name)) g.primary = file;
    }
  }
  const out: AppVersion[] = [];
  for (const [version, g] of groups) {
    if (g.files.length === 0) continue;
    if (!g.primary) g.primary = g.files[0];
    out.push({
      version,
      files: g.files,
      primaryFile: g.primary,
      totalSize: g.total,
      mtime: g.mtime,
    });
  }
  out.sort((a, b) => compareVersions(b.version, a.version));
  return out;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[._-]/);
  const pb = b.split(/[._-]/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? "0";
    const bi = pb[i] ?? "0";
    const an = parseInt(ai, 10);
    const bn = parseInt(bi, 10);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    if (ai !== bi) return ai.localeCompare(bi);
  }
  return 0;
}

function readScreenshots(type: AppType, slug: string): string[] {
  const dir = path.join(assetsDir(type, slug), "screenshots");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
    .sort();
}

function readMeta(type: AppType, slug: string): AppMeta {
  const file = infoFile(type, slug);
  if (!fs.existsSync(file)) {
    return { name: slug };
  }
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;
  return {
    name: typeof fm.name === "string" ? fm.name : slug,
    developer: typeof fm.developer === "string" ? fm.developer : undefined,
    category: typeof fm.category === "string" ? fm.category : undefined,
    tagline: typeof fm.tagline === "string" ? fm.tagline : undefined,
    description: typeof fm.description === "string" ? fm.description : undefined,
    tags: Array.isArray(fm.tags) ? (fm.tags as unknown[]).map((t) => String(t)) : undefined,
    website: typeof fm.website === "string" ? fm.website : undefined,
    body: parsed.content?.trim() || undefined,
  };
}

export function readEntry(type: AppType, slug: string): AppEntry | null {
  const dir = appDir(type, slug);
  if (!fs.existsSync(dir)) return null;
  const assets = assetsDir(type, slug);
  const info = infoFile(type, slug);
  const versions = readVersions(dir);
  const meta = readMeta(type, slug);
  const logo = findLogo(type, slug);
  const banner = findBanner(type, slug);
  const screenshots = readScreenshots(type, slug);
  const updatedAt = versions.reduce((m, v) => Math.max(m, v.mtime), 0);
  return {
    type,
    slug,
    hasAssets: fs.existsSync(assets),
    hasInfo: fs.existsSync(info),
    hasLogo: !!logo,
    hasBanner: !!banner,
    meta,
    versions,
    latest: versions[0],
    screenshots,
    updatedAt,
  };
}

export function listType(type: AppType): AppEntry[] {
  const dir = path.join(STORE_ROOT, type);
  if (!fs.existsSync(dir)) return [];
  const out: AppEntry[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (!isValidSlug(e.name)) continue;
    const entry = readEntry(type, e.name);
    if (entry) out.push(entry);
  }
  out.sort((a, b) => a.meta.name.localeCompare(b.meta.name, "en"));
  return out;
}

export function listAll(): AppEntry[] {
  return [...listType("apps"), ...listType("games")];
}

export function isValidType(type: string): type is AppType {
  return (TYPES as readonly string[]).includes(type);
}

/** Decode a slug coming from a route param. Safe against double-encoded or malformed input. */
export function decodeSlug(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
