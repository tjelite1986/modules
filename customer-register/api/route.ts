import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateCustomerNumber, composeName } from "@/lib/customers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(customers).orderBy(desc(customers.createdAt));
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const firstName = body.firstName?.trim() || "";
  const lastName = body.lastName?.trim() || "";
  const name = body.name || composeName(firstName, lastName);
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const [customer] = await db
    .insert(customers)
    .values({
      userId: parseInt(session.user.id),
      customerNumber: body.customerNumber || generateCustomerNumber(),
      name,
      firstName: firstName || null,
      lastName: lastName || null,
      ssn: body.ssn || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      postalCode: body.postalCode || null,
      city: body.city || null,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(customer);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  const [updated] = await db
    .update(customers)
    .set(updates)
    .where(eq(customers.id, parseInt(id)))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  await db.delete(customers).where(eq(customers.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
