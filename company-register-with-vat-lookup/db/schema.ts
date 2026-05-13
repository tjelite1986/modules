import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyNumber: text("company_number").notNull().unique(),
  companyName: text("company_name").notNull(),
  organisationNumber: text("organisation_number"),
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
