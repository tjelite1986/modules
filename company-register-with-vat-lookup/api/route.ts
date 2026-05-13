import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateCompanyNumber } from "@/lib/vat";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(companies).orderBy(desc(companies.createdAt));
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }

  const companyNumber = generateCompanyNumber();

  const [company] = await db
    .insert(companies)
    .values({
      companyNumber,
      companyName: body.companyName.trim(),
      organisationNumber: body.organisationNumber?.trim() || null,
      address: body.address?.trim() || null,
      postalCode: body.postalCode?.trim() || null,
      city: body.city?.trim() || null,
      contactPerson: body.contactPerson?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      paymentTerms: body.paymentTerms?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .returning();

  return NextResponse.json(company);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  const { id, ...rest } = body;
  const updates: Record<string, string | null> = {};
  const fields = [
    "companyName",
    "organisationNumber",
    "address",
    "postalCode",
    "city",
    "contactPerson",
    "phone",
    "email",
    "paymentTerms",
    "notes",
  ] as const;
  for (const f of fields) {
    if (f in rest) updates[f] = rest[f]?.trim() || null;
  }

  const [updated] = await db
    .update(companies)
    .set(updates)
    .where(eq(companies.id, parseInt(id)))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id is required" }, { status: 400 });

  await db.delete(companies).where(eq(companies.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
