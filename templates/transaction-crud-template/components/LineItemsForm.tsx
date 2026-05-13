"use client";

import { Plus, X } from "lucide-react";
import type { LineItemDraft } from "@/lib/line-items";

/**
 * Reusable line-item form for transactional records (invoices, sales receipts,
 * pickup orders, etc). Pairs with lib/line-items.ts and (optionally) the
 * article-catalog-with-pricing module for autocomplete.
 *
 * Usage:
 *   <LineItemsForm
 *     items={form.items}
 *     onUpdate={updateItem}
 *     onLookup={lookupItem}
 *     onAdd={addItem}
 *     onRemove={removeItem}
 *     accent="emerald"
 *   />
 */

type AccentColor = "emerald" | "purple" | "indigo" | "orange";

const COLORS: Record<
  AccentColor,
  { input: string; spinnerBorder: string; spinnerHead: string; addBtn: string }
> = {
  emerald: {
    input: "focus:border-emerald-500/60",
    spinnerBorder: "border-emerald-500/40",
    spinnerHead: "border-t-emerald-500",
    addBtn: "text-emerald-400 hover:text-emerald-300",
  },
  purple: {
    input: "focus:border-purple-500/60",
    spinnerBorder: "border-purple-500/40",
    spinnerHead: "border-t-purple-500",
    addBtn: "text-purple-400 hover:text-purple-300",
  },
  indigo: {
    input: "focus:border-indigo-500/60",
    spinnerBorder: "border-indigo-500/40",
    spinnerHead: "border-t-indigo-500",
    addBtn: "text-indigo-400 hover:text-indigo-300",
  },
  orange: {
    input: "focus:border-orange-500/60",
    spinnerBorder: "border-orange-500/40",
    spinnerHead: "border-t-orange-500",
    addBtn: "text-orange-400 hover:text-orange-300",
  },
};

const BASE_INPUT =
  "w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors";

interface Props {
  items: LineItemDraft[];
  onUpdate: (
    id: string,
    field: keyof Omit<LineItemDraft, "_id" | "lookingUp">,
    value: string,
  ) => void;
  onLookup: (id: string, articleNumber: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  accent: AccentColor;
}

export function LineItemsForm({ items, onUpdate, onLookup, onAdd, onRemove, accent }: Props) {
  const c = COLORS[accent];
  const total = items.reduce(
    (sum, v) => sum + parseFloat(v.quantity || "0") * parseFloat(v.price || "0"),
    0,
  );

  return (
    <div className="space-y-2">
      {/* Column headers — desktop only */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-1">
        <span className="col-span-3 text-xs text-gray-600 uppercase tracking-wide">Article #</span>
        <span className="col-span-4 text-xs text-gray-600 uppercase tracking-wide">Name</span>
        <span className="col-span-2 text-xs text-gray-600 uppercase tracking-wide">Qty</span>
        <span className="col-span-2 text-xs text-gray-600 uppercase tracking-wide">Price/unit</span>
        <span className="col-span-1" />
      </div>

      {items.map((item) => (
        <div key={item._id}>
          {/* Mobile: card layout */}
          <div className="md:hidden space-y-2 p-3 border border-dark-border/50 rounded-lg bg-dark-card2/30">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={item.articleNumber}
                onChange={(e) => onUpdate(item._id, "articleNumber", e.target.value)}
                onBlur={() => onLookup(item._id, item.articleNumber)}
                placeholder="Article #"
                className={`${BASE_INPUT} ${c.input}`}
              />
              <div className="relative">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => onUpdate(item._id, "name", e.target.value)}
                  placeholder={item.lookingUp ? "Loading..." : "Name"}
                  className={`${BASE_INPUT} ${c.input}`}
                />
                {item.lookingUp && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div
                      className={`w-4 h-4 border-2 rounded-full animate-spin ${c.spinnerBorder} ${c.spinnerHead}`}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdate(item._id, "quantity", e.target.value)}
                placeholder="Qty"
                className={`w-20 bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors ${c.input}`}
              />
              <input
                type="text"
                inputMode="decimal"
                value={item.price}
                onChange={(e) => onUpdate(item._id, "price", e.target.value)}
                placeholder="Price"
                className={`flex-1 ${BASE_INPUT} ${c.input}`}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(item._id)}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded flex-shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Desktop: row layout */}
          <div className="hidden md:grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3">
              <input
                type="text"
                value={item.articleNumber}
                onChange={(e) => onUpdate(item._id, "articleNumber", e.target.value)}
                onBlur={() => onLookup(item._id, item.articleNumber)}
                placeholder="e.g. 803700"
                className={`${BASE_INPUT} ${c.input}`}
              />
            </div>
            <div className="col-span-4 relative">
              <input
                type="text"
                value={item.name}
                onChange={(e) => onUpdate(item._id, "name", e.target.value)}
                placeholder={item.lookingUp ? "Loading..." : "Auto-filled from lookup"}
                className={`${BASE_INPUT} ${c.input}`}
              />
              {item.lookingUp && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div
                    className={`w-4 h-4 border-2 rounded-full animate-spin ${c.spinnerBorder} ${c.spinnerHead}`}
                  />
                </div>
              )}
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdate(item._id, "quantity", e.target.value)}
                className={`${BASE_INPUT} ${c.input}`}
              />
            </div>
            <div className="col-span-2">
              <input
                type="text"
                inputMode="decimal"
                value={item.price}
                onChange={(e) => onUpdate(item._id, "price", e.target.value)}
                placeholder="0.00"
                className={`${BASE_INPUT} ${c.input}`}
              />
              {item.bundleQuantity && item.bundlePrice && (
                <p className="text-xs text-amber-400/70 mt-0.5 truncate">
                  {item.bundleQuantity} for {Number(item.bundlePrice).toFixed(2)}
                </p>
              )}
            </div>
            <div className="col-span-1 flex justify-center">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(item._id)}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onAdd}
          className={`flex items-center gap-1.5 text-xs transition-colors ${c.addBtn}`}
        >
          <Plus size={13} /> Add row
        </button>
        <div className="text-sm text-gray-400">
          Total:{" "}
          <span className="text-white font-semibold">
            {total.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
