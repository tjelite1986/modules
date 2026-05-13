import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = process.env.LATEST_APK_VERSION ?? APP_VERSION;
  return NextResponse.json({ version });
}
