// Template for a "transaction" CRUD route.
//
// Replace placeholders before use:
//   {{entity}}     camelCase singular  → invoice, salesReceipt, pickupOrder
//   {{entities}}   plural lowercase    → invoices, sales_receipts, pickup_orders
//   {{ENTITY}}     PascalCase singular → Invoice, SalesReceipt, PickupOrder

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { {{entities}} } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

function generateReferenceNumber(): string {
  // Replace with your project's numbering format
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `${year}-${rand}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const isAdmin = session.user.role === "admin";

  const result = isAdmin
    ? await db.select().from({{entities}}).orderBy(desc({{entities}}.createdAt))
    : await db
        .select()
        .from({{entities}})
        .where(eq({{entities}}.userId, userId))
        .orderBy(desc({{entities}}.createdAt));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  const totalAmount = body.items.reduce(
    (sum: number, item: { quantity: number; price: number }) =>
      sum + Number(item.quantity) * Number(item.price),
    0,
  );

  const [created] = await db
    .insert({{entities}})
    .values({
      userId: parseInt(session.user.id),
      referenceNumber: body.referenceNumber || generateReferenceNumber(),
      date: body.date || new Date().toISOString().slice(0, 10),
      customerName: body.customerName || null,
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      ssn: body.ssn || null,
      customerNumber: body.customerNumber || null,
      items: JSON.stringify(body.items),
      totalAmount,
      paymentMethod: body.paymentMethod || "card",
      status: body.status, // default applies if undefined
      issuedBy: session.user.name ?? session.user.email ?? "Unknown",
      comments: body.comments || null,
    })
    .returning();

  return NextResponse.json(created);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  // Re-stringify items if present so the column stays JSON-encoded
  if (Array.isArray(updates.items)) {
    updates.items = JSON.stringify(updates.items);
  }

  const [updated] = await db
    .update({{entities}})
    .set(updates)
    .where(eq({{entities}}.id, parseInt(id)))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  // Optional: only admins may delete
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete({{entities}}).where(eq({{entities}}.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
