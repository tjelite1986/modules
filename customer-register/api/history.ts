// OPTIONAL: aggregates transactions for a customer across multiple tables.
//
// This file assumes the following tables exist in your schema:
//   - salesReceipts
//   - repairReceipts (a.k.a. receipts)
//   - orders
//   - invoices
//   - pickupOrders
//
// Each table is expected to have `customerNumber` and `ssn` columns plus
// `createdAt`. If your project only has some of these, delete the entries
// you don't need from the Promise.all and the response object below.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  salesReceipts,
  repairReceipts,
  orders,
  invoices,
  pickupOrders,
} from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customerNumber = request.nextUrl.searchParams.get("customer_number") || "";
  const ssn = request.nextUrl.searchParams.get("ssn") || "";

  if (!customerNumber && !ssn) {
    return NextResponse.json(
      { error: "customer_number or ssn is required" },
      { status: 400 },
    );
  }

  function where(
    cnrCol: Parameters<typeof eq>[0],
    ssnCol: Parameters<typeof eq>[0],
  ) {
    if (customerNumber && ssn) return or(eq(cnrCol, customerNumber), eq(ssnCol, ssn));
    if (customerNumber) return eq(cnrCol, customerNumber);
    return eq(ssnCol, ssn);
  }

  const [sales, repairs, orderList, invoiceList, pickupList] = await Promise.all([
    db
      .select()
      .from(salesReceipts)
      .where(where(salesReceipts.customerNumber, salesReceipts.ssn))
      .orderBy(desc(salesReceipts.createdAt)),
    db
      .select()
      .from(repairReceipts)
      .where(where(repairReceipts.customerNumber, repairReceipts.ssn))
      .orderBy(desc(repairReceipts.createdAt)),
    db
      .select()
      .from(orders)
      .where(where(orders.customerNumber, orders.ssn))
      .orderBy(desc(orders.createdAt)),
    db
      .select()
      .from(invoices)
      .where(where(invoices.customerNumber, invoices.ssn))
      .orderBy(desc(invoices.createdAt)),
    db
      .select()
      .from(pickupOrders)
      .where(where(pickupOrders.customerNumber, pickupOrders.ssn))
      .orderBy(desc(pickupOrders.createdAt)),
  ]);

  return NextResponse.json({
    salesReceipts: sales,
    repairReceipts: repairs,
    orders: orderList,
    invoices: invoiceList,
    pickupOrders: pickupList,
  });
}
