import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const posts = db.prepare(`
    SELECT p.id, p.user_id, p.content, p.media_url, p.media_type, p.media_name, p.created_at,
      p.shared_channel_id, p.shared_channel_name, p.shared_message_content,
      p.shared_message_username, p.shared_file_url, p.shared_file_type, p.shared_file_name,
      COALESCE(u.display_name, u.username) AS display_name,
      u.username, u.avatar,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
      EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS liked_by_me
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all(user.id) as any[];

  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    content, mediaUrl, mediaType, mediaName,
    sharedChannelId, sharedChannelName, sharedMessageContent,
    sharedMessageUsername, sharedFileUrl, sharedFileType, sharedFileName,
  } = await req.json();

  const hasContent = content?.trim() || mediaUrl || sharedMessageContent || sharedFileUrl;
  if (!hasContent) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO posts (
      user_id, content, media_url, media_type, media_name,
      shared_channel_id, shared_channel_name, shared_message_content,
      shared_message_username, shared_file_url, shared_file_type, shared_file_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    content?.trim() || null,
    mediaUrl || null,
    mediaType || null,
    mediaName || null,
    sharedChannelId || null,
    sharedChannelName || null,
    sharedMessageContent || null,
    sharedMessageUsername || null,
    sharedFileUrl || null,
    sharedFileType || null,
    sharedFileName || null,
  );

  const post = db.prepare(`
    SELECT p.id, p.user_id, p.content, p.media_url, p.media_type, p.media_name, p.created_at,
      p.shared_channel_id, p.shared_channel_name, p.shared_message_content,
      p.shared_message_username, p.shared_file_url, p.shared_file_type, p.shared_file_name,
      COALESCE(u.display_name, u.username) AS display_name,
      u.username, u.avatar,
      0 AS like_count, 0 AS comment_count, 0 AS liked_by_me
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);

  const io = (global as any)._io;
  if (io) io.emit('new-feed-post', post);

  return NextResponse.json(post);
}
