import { getDb } from "./db";
import { readProfile } from "./profileStore";
import { createNotification } from "./notifications";

export interface BadgeProgress {
  current: number;
  target: number;
}

export interface BadgeDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  evaluate: (ctx: BadgeContext) => boolean;
  /** Optional progress reporter for unearned badges. */
  progress?: (ctx: BadgeContext) => BadgeProgress;
}

export interface BadgeMeta {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface BadgeContext {
  userId: number;
  username: string;
  fields: Record<string, string | string[] | null>;
  isAdmin: boolean;
  hasAvatar: boolean;
  hasBanner: boolean;
  joinRank: number;
}

export interface EarnedBadge {
  key: string;
  earnedAt: string;
}

export const badgeDefs: BadgeDef[] = [
  {
    key: "welcome",
    label: "Welcome",
    description: "Joined the elite club",
    icon: "Sparkles",
    color: "bg-pink-500/15 text-pink-300 border-pink-500/30",
    evaluate: () => true,
  },
  {
    key: "personalized",
    label: "Personalized",
    description: "Uploaded both an avatar and a banner",
    icon: "Camera",
    color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    evaluate: (c) => c.hasAvatar && c.hasBanner,
    progress: (c) => ({
      current: (c.hasAvatar ? 1 : 0) + (c.hasBanner ? 1 : 0),
      target: 2,
    }),
  },
  {
    key: "complete-profile",
    label: "Complete profile",
    description: "Filled in display name, bio, location, and a social link",
    icon: "CircleCheck",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    evaluate: (c) =>
      truthyString(c.fields.displayName) &&
      truthyString(c.fields.bio) &&
      truthyString(c.fields.location) &&
      ["website", "github", "twitter", "mastodon"].some((k) => truthyString(c.fields[k])),
    progress: (c) => {
      const checks = [
        truthyString(c.fields.displayName),
        truthyString(c.fields.bio),
        truthyString(c.fields.location),
        ["website", "github", "twitter", "mastodon"].some((k) => truthyString(c.fields[k])),
      ];
      return { current: checks.filter(Boolean).length, target: 4 };
    },
  },
  {
    key: "social-butterfly",
    label: "Social butterfly",
    description: "Linked at least 3 socials",
    icon: "Users",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    evaluate: (c) =>
      ["website", "github", "twitter", "mastodon"].filter((k) => truthyString(c.fields[k]))
        .length >= 3,
    progress: (c) => ({
      current: ["website", "github", "twitter", "mastodon"].filter((k) =>
        truthyString(c.fields[k]),
      ).length,
      target: 3,
    }),
  },
  {
    key: "tagged",
    label: "Tagged",
    description: "Added 5 or more tags",
    icon: "Tag",
    color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    evaluate: (c) => Array.isArray(c.fields.tags) && (c.fields.tags as string[]).length >= 5,
    progress: (c) => ({
      current: Array.isArray(c.fields.tags) ? (c.fields.tags as string[]).length : 0,
      target: 5,
    }),
  },
  {
    key: "pioneer",
    label: "Pioneer",
    description: "One of the first 10 users",
    icon: "Rocket",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    evaluate: (c) => c.joinRank > 0 && c.joinRank <= 10,
  },
  {
    key: "admin",
    label: "Admin",
    description: "Has administrative privileges",
    icon: "Shield",
    color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    evaluate: (c) => c.isAdmin,
  },
];

export const badgesByKey: Record<string, BadgeDef> = Object.fromEntries(
  badgeDefs.map((b) => [b.key, b]),
);

export const badgeMeta: BadgeMeta[] = badgeDefs.map(({ evaluate, ...rest }) => rest);

function truthyString(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function getEarnedBadges(userId: number): EarnedBadge[] {
  const db = getDb();
  return db
    .prepare("SELECT badge_key AS key, earned_at AS earnedAt FROM badges_earned WHERE user_id = ? ORDER BY earned_at ASC")
    .all(userId) as EarnedBadge[];
}

export interface BadgeProgressInfo {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  current: number;
  target: number;
}

/** Returns progress info for badges that aren't earned yet but have a progress fn. */
export function getInProgressBadges(userId: number): BadgeProgressInfo[] {
  const db = getDb();
  const dbUser = db
    .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
    .get(userId) as { id: number; username: string; is_admin: number } | undefined;
  if (!dbUser) return [];

  const profile = readProfile(dbUser.username);
  const allUsers = db
    .prepare("SELECT id FROM users ORDER BY created_at ASC, id ASC")
    .all() as Array<{ id: number }>;
  const joinRank = allUsers.findIndex((u) => u.id === userId) + 1;

  const ctx: BadgeContext = {
    userId,
    username: dbUser.username,
    fields: profile.fields,
    isAdmin: Boolean(dbUser.is_admin),
    hasAvatar: profile.avatarPath !== null,
    hasBanner: profile.bannerPath !== null,
    joinRank,
  };

  const earnedKeys = new Set(getEarnedBadges(userId).map((b) => b.key));
  const out: BadgeProgressInfo[] = [];
  for (const def of badgeDefs) {
    if (earnedKeys.has(def.key) || !def.progress) continue;
    let p: BadgeProgress;
    try {
      p = def.progress(ctx);
    } catch {
      continue;
    }
    out.push({
      key: def.key,
      label: def.label,
      description: def.description,
      icon: def.icon,
      color: def.color,
      current: Math.min(p.current, p.target),
      target: p.target,
    });
  }
  return out;
}

export function evaluateBadges(userId: number): EarnedBadge[] {
  const db = getDb();
  const dbUser = db
    .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
    .get(userId) as { id: number; username: string; is_admin: number } | undefined;
  if (!dbUser) return [];

  const profile = readProfile(dbUser.username);
  const allUsers = db.prepare("SELECT id FROM users ORDER BY created_at ASC, id ASC").all() as Array<{
    id: number;
  }>;
  const joinRank = allUsers.findIndex((u) => u.id === userId) + 1;

  const ctx: BadgeContext = {
    userId,
    username: dbUser.username,
    fields: profile.fields,
    isAdmin: Boolean(dbUser.is_admin),
    hasAvatar: profile.avatarPath !== null,
    hasBanner: profile.bannerPath !== null,
    joinRank,
  };

  const already = new Set(
    (db
      .prepare("SELECT badge_key FROM badges_earned WHERE user_id = ?")
      .all(userId) as Array<{ badge_key: string }>).map((r) => r.badge_key),
  );

  const newlyEarned: string[] = [];
  for (const def of badgeDefs) {
    if (already.has(def.key)) continue;
    let ok = false;
    try {
      ok = def.evaluate(ctx);
    } catch (err) {
      console.error(`[badges] eval ${def.key}`, err);
    }
    if (!ok) continue;
    db.prepare("INSERT OR IGNORE INTO badges_earned (user_id, badge_key) VALUES (?, ?)").run(
      userId,
      def.key,
    );
    newlyEarned.push(def.key);
  }

  if (newlyEarned.length) {
    for (const key of newlyEarned) {
      db.prepare("INSERT INTO activity (user_id, type, payload) VALUES (?, ?, ?)").run(
        userId,
        "badge.earned",
        JSON.stringify({ key }),
      );
      const meta = badgesByKey[key];
      createNotification(userId, "badge.earned", {
        key,
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        color: meta.color,
      });
    }
  }

  return getEarnedBadges(userId);
}
