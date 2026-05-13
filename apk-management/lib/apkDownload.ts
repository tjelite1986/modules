import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

/**
 * Download and install an APK on Android (requires Capacitor).
 * url: URL to the APK file
 * onProgress: callback with percent (0-100)
 */
export async function downloadAndInstallApk(
  url: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Download failed');

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) onProgress(Math.round((received / contentLength) * 100));
  }

  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  const base64 = btoa(binary);

  const result = await Filesystem.writeFile({
    path: 'app-update.apk',
    data: base64,
    directory: Directory.Cache,
  });

  await FileOpener.open({
    filePath: result.uri,
    contentType: 'application/vnd.android.package-archive',
    openWithDefault: true,
  });
}
