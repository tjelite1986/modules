import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleNumber: text("article_number").notNull().unique(),
  name: text("name").notNull(),
  price: real("price"),
  // Bulk pricing: bundlePrice charges for any quantity of bundleQuantity items.
  // Example: bundleQuantity=3, bundlePrice=99 → "3 for 99".
  bundleQuantity: integer("bundle_quantity"),
  bundlePrice: real("bundle_price"),
  category: text("category"),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
