import path from 'path';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']);
const VIDEO_EXTS = new Set(['mp4', 'mov']);

export function getUploadsRoot(): string {
  return process.env.UPLOADS_DIR || path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'uploads');
}

export function getSubDir(ext: string): string {
  if (IMAGE_EXTS.has(ext)) return 'photo';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (ext === 'apk') return 'apk';
  return 'files';
}

export function getUploadPath(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return path.join(getUploadsRoot(), getSubDir(ext), filename);
}

export function getAvatarsDir(): string {
  return path.join(getUploadsRoot(), 'avatars');
}

export function getChannelAssetsDir(): string {
  return path.join(getUploadsRoot(), 'channel-assets');
}
