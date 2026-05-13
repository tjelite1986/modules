"use client";

import clsx from "clsx";

export function CategoryFilter({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string | null;
  onChange: (c: string | null) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
      <button
        onClick={() => onChange(null)}
        className={clsx(
          "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition",
          active === null
            ? "bg-indigo-600 text-white border-indigo-600"
            : "border-zinc-700 text-zinc-300 hover:border-zinc-500",
        )}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={clsx(
            "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition",
            active === c
              ? "bg-indigo-600 text-white border-indigo-600"
              : "border-zinc-700 text-zinc-300 hover:border-zinc-500",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
