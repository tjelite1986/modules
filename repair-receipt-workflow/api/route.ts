import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { repairReceipts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateReceiptNumber } from "@/lib/repair-receipts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const isAdmin = session.user.role === "admin";

  const result = isAdmin
    ? await db.select().from(repairReceipts).orderBy(desc(repairReceipts.createdAt))
    : await db
        .select()
        .from(repairReceipts)
        .where(eq(repairReceipts.userId, userId))
        .orderBy(desc(repairReceipts.createdAt));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!body.customerName || !body.intakeDate) {
    return NextResponse.json(
      { error: "customerName and intakeDate are required" },
      { status: 400 },
    );
  }

  const [receipt] = await db
    .insert(repairReceipts)
    .values({
      userId: parseInt(session.user.id),
      receiptNumber: generateReceiptNumber(),
      intakeDate: body.intakeDate,
      customerName: body.customerName,
      ssn: body.ssn || null,
      customerEmail: body.customerEmail || null,
      customerPhone: body.customerPhone || null,
      customerAddress: body.customerAddress || null,
      customerPostalCode: body.customerPostalCode || null,
      customerCity: body.customerCity || null,
      receiptIssuer: session.user.name ?? session.user.email ?? "Unknown",
      customerNumber: body.customerNumber || null,
      originalReceiptNumber: body.originalReceiptNumber || null,
      warranty: body.warranty ? true : false,
      inspectionRequested: body.inspectionRequested ? true : false,
      store: body.store || null,
      storeCity: body.storeCity || null,
      articleNumber: body.articleNumber || null,
      itemName: body.itemName || null,
      faultDescription: body.faultDescription || null,
      action: body.action || null,
      technician: body.technician || null,
      maxCost: body.maxCost ? parseFloat(body.maxCost) : null,
      actionDate: body.actionDate || null,
      comments: body.comments || null,
    })
    .returning();

  return NextResponse.json(receipt);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  const [updated] = await db
    .update(repairReceipts)
    .set(updates)
    .where(eq(repairReceipts.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}
