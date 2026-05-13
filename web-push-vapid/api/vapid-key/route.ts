import { NextResponse } from "next/server";
import { publicVapidKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ publicKey: publicVapidKey() });
}
