import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET /api/channels/[id]/messages
// Returns the 1000 most recent messages, oldest first.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const channelId = parseInt(params.id);
  if (isNaN(channelId)) return NextResponse.json({ error: 'Invalid channel ID' }, { status: 400 });

  const db = getDb();
  const recent = db.prepare(`
    SELECT m.*, u.username, u.avatar
    FROM messages m JOIN users u ON m.user_id = u.id
    WHERE m.channel_id = ? AND (m.expires_at IS NULL OR m.expires_at > datetime('now'))
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1000
  `).all(channelId) as any[];
  const messages = recent.slice().reverse();

  if (messages.length === 0) return NextResponse.json([]);

  const ids = messages.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');

  const reactions = db.prepare(
    `SELECT r.message_id, r.emoji, u.username FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.message_id IN (${placeholders})`
  ).all(...ids) as any[];

  const reactionMap: Record<number, Record<string, string[]>> = {};
  for (const r of reactions) {
    if (!reactionMap[r.message_id]) reactionMap[r.message_id] = {};
    if (!reactionMap[r.message_id][r.emoji]) reactionMap[r.message_id][r.emoji] = [];
    reactionMap[r.message_id][r.emoji].push(r.username);
  }

  const replyIdsSet: Record<number, true> = {};
  messages.filter(m => m.reply_to).forEach(m => { replyIdsSet[m.reply_to] = true; });
  const replyIds = Object.keys(replyIdsSet).map(Number);
  const replyMap: Record<number, { content: string; username: string }> = {};
  if (replyIds.length > 0) {
    const rp = replyIds.map(() => '?').join(',');
    const replies = db.prepare(
      `SELECT m.id, m.content, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id IN (${rp})`
    ).all(...replyIds) as any[];
    for (const r of replies) replyMap[r.id] = { content: r.content, username: r.username };
  }

  return NextResponse.json(messages.map(m => ({
    id: m.id,
    channelId: m.channel_id,
    userId: m.user_id,
    username: m.username,
    avatar: m.avatar ?? undefined,
    content: m.content,
    fileUrl: m.file_url,
    fileType: m.file_type,
    fileName: m.file_name,
    fileSize: m.file_size,
    replyTo: m.reply_to,
    replyToContent: m.reply_to ? replyMap[m.reply_to]?.content : undefined,
    replyToUsername: m.reply_to ? replyMap[m.reply_to]?.username : undefined,
    expiresAt: m.expires_at,
    editedAt: m.edited_at ?? undefined,
    createdAt: m.created_at,
    reactions: reactionMap[m.id] || {},
  })));
}
