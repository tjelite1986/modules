import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

const BUILTIN_IDS = ['apk', 'photo', 'video', 'tiktok', 'files'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const channelId = body.autoshareChannelId === undefined
    ? undefined
    : body.autoshareChannelId === null ? null : Number(body.autoshareChannelId);
  const label = body.label?.trim() || undefined;
  const icon = body.icon || undefined;

  const db = getDb();
  db.prepare(`
    INSERT INTO folder_config (id, label, icon, autoshare_channel_id, autoshare_user_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = COALESCE(excluded.label, label),
      icon = COALESCE(excluded.icon, icon),
      autoshare_channel_id = CASE WHEN ? IS NOT NULL THEN excluded.autoshare_channel_id ELSE autoshare_channel_id END,
      autoshare_user_id = CASE WHEN ? IS NOT NULL THEN excluded.autoshare_user_id ELSE autoshare_user_id END
  `).run(
    params.id,
    label ?? params.id,
    icon ?? 'folder',
    channelId ?? null,
    channelId !== null && channelId !== undefined ? user.id : null,
    channelId,
    channelId,
  );

  if ((global as any)._syncWatchers) (global as any)._syncWatchers();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (BUILTIN_IDS.includes(params.id)) {
    return NextResponse.json({ error: 'Cannot delete builtin folders' }, { status: 403 });
  }

  const db = getDb();
  db.prepare('DELETE FROM folder_config WHERE id = ?').run(params.id);

  if ((global as any)._syncWatchers) (global as any)._syncWatchers();
  return NextResponse.json({ ok: true });
}
