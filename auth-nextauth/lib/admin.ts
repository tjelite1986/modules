import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Use in API routes to gate admin-only endpoints:
 *
 *   const guard = await requireAdmin();
 *   if (guard) return guard;
 *   // ...rest of handler
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  return null;
}
