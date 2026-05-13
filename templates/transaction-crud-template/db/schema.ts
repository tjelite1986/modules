// Template for a "transaction" entity — a CRUD record that carries a list
// of line items as JSON, a total, a payment method, and a status.
//
// Replace placeholders before use:
//   {{entity}}          camelCase singular  → e.g. invoice, salesReceipt, pickupOrder
//   {{entities}}        plural lowercase    → e.g. invoices, sales_receipts, pickup_orders
//   {{ENTITY}}          PascalCase singular → e.g. Invoice, SalesReceipt, PickupOrder
//   {{StatusEnum}}      status union        → e.g. ["unpaid", "paid", "overdue"]
//   {{defaultStatus}}   default status      → e.g. "unpaid"

import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const {{entities}} = sqliteTable("{{entities}}", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),

  // Reference number (auto-generated; format chosen per entity)
  referenceNumber: text("reference_number").notNull(),
  date: text("date").notNull(),

  // Customer (denormalised; pair with customer-register if you want a join)
  customerName: text("customer_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  ssn: text("ssn"),
  customerNumber: text("customer_number"),

  // Line items as JSON; see lib/line-items.ts for the LineItem type
  items: text("items").notNull(),
  totalAmount: real("total_amount").notNull(),

  paymentMethod: text("payment_method", {
    enum: ["cash", "card", "swish", "invoice"],
  })
    .notNull()
    .default("card"),

  // Replace the enum and default per entity
  status: text("status", {
    enum: {{StatusEnum}},
  })
    .notNull()
    .default({{defaultStatus}}),

  issuedBy: text("issued_by").notNull(),
  comments: text("comments"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type {{ENTITY}} = typeof {{entities}}.$inferSelect;
export type New{{ENTITY}} = typeof {{entities}}.$inferInsert;
