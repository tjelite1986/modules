import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const repairReceipts = sqliteTable("repair_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  receiptNumber: text("receipt_number").notNull(),
  intakeDate: text("intake_date").notNull(),

  // Customer (denormalised — see customer-register module for a normalised version)
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  customerPostalCode: text("customer_postal_code"),
  customerCity: text("customer_city"),
  ssn: text("ssn"),
  customerNumber: text("customer_number"),

  receiptIssuer: text("receipt_issuer").notNull(),
  originalReceiptNumber: text("original_receipt_number"),
  warranty: integer("warranty", { mode: "boolean" }).notNull().default(false),
  inspectionRequested: integer("inspection_requested", { mode: "boolean" })
    .notNull()
    .default(false),

  // Optional store/branch info
  store: text("store"),
  storeCity: text("store_city"),

  // Item being repaired
  articleNumber: text("article_number"),
  itemName: text("item_name"),

  faultDescription: text("fault_description"),
  action: text("action"),
  technician: text("technician"),
  maxCost: real("max_cost"),
  actionDate: text("action_date"),
  comments: text("comments"),

  status: text("status", {
    enum: ["intake", "in_progress", "ready", "picked_up"],
  })
    .notNull()
    .default("intake"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type RepairReceipt = typeof repairReceipts.$inferSelect;
export type NewRepairReceipt = typeof repairReceipts.$inferInsert;
export type RepairStatus = RepairReceipt["status"];
