import { getDb } from "./db";
import { LIBRARIES, type LibraryKey } from "./libraries";

export interface ClipStats {
  likes: number;
  views: number;
}

function tables(library: LibraryKey) {
  return LIBRARIES[library].tables;
}

export function getClipStats(slug: string, library: LibraryKey = "clips"): ClipStats {
  const db = getDb();
  const t = tables(library);
  const likes = (db
    .prepare(`SELECT COUNT(*) AS n FROM ${t.likes} WHERE slug = ?`)
    .get(slug) as { n: number }).n;
  const views = (db
    .prepare(`SELECT COUNT(*) AS n FROM ${t.views} WHERE slug = ?`)
    .get(slug) as { n: number }).n;
  return { likes, views };
}

/**
 * Returns a Map<slug, {likes, views}> for all clips in one pass.
 */
export function getAllClipStats(library: LibraryKey = "clips"): Map<string, ClipStats> {
  const db = getDb();
  const t = tables(library);
  const out = new Map<string, ClipStats>();
  const likes = db
    .prepare(`SELECT slug, COUNT(*) AS n FROM ${t.likes} GROUP BY slug`)
    .all() as Array<{ slug: string; n: number }>;
  const views = db
    .prepare(`SELECT slug, COUNT(*) AS n FROM ${t.views} GROUP BY slug`)
    .all() as Array<{ slug: string; n: number }>;
  for (const r of likes) out.set(r.slug, { likes: r.n, views: 0 });
  for (const r of views) {
    const cur = out.get(r.slug) ?? { likes: 0, views: 0 };
    cur.views = r.n;
    out.set(r.slug, cur);
  }
  return out;
}

/**
 * Returns the set of slugs the given user has liked in this library.
 */
export function getUserLikedSlugs(userId: number, library: LibraryKey = "clips"): Set<string> {
  const db = getDb();
  const t = tables(library);
  const rows = db
    .prepare(`SELECT slug FROM ${t.likes} WHERE user_id = ?`)
    .all(userId) as Array<{ slug: string }>;
  return new Set(rows.map((r) => r.slug));
}

export function setClipLike(
  userId: number,
  slug: string,
  liked: boolean,
  library: LibraryKey = "clips",
): void {
  const db = getDb();
  const t = tables(library);
  if (liked) {
    db.prepare(
      `INSERT OR IGNORE INTO ${t.likes} (user_id, slug) VALUES (?, ?)`,
    ).run(userId, slug);
  } else {
    db.prepare(`DELETE FROM ${t.likes} WHERE user_id = ? AND slug = ?`).run(
      userId,
      slug,
    );
  }
}

export function recordClipView(
  userId: number,
  slug: string,
  library: LibraryKey = "clips",
): void {
  const db = getDb();
  const t = tables(library);
  db.prepare(
    `INSERT OR IGNORE INTO ${t.views} (user_id, slug) VALUES (?, ?)`,
  ).run(userId, slug);
}
