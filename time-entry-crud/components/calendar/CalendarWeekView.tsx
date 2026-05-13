"use client";

import { useMemo } from "react";
import { getWeekNumber } from "../../lib/time-utils";
import type { CalendarEntry, ScheduleEntry, RedDayInfo } from "./CalendarMonthView";

interface Props {
  weekOffset: number;
  entries: CalendarEntry[];
  redDays?: RedDayInfo[];
  onDayClick: (date: string, entries: CalendarEntry[]) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onPrev: () => void;
  onNext: () => void;
  getScheduledEntry?: (date: string, dayOfWeek: number) => ScheduleEntry | null;
  formatSecondary?: (value: number) => string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(offset: number): string[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}

function defaultFormatSecondary(amount: number): string {
  return Math.round(amount).toLocaleString() + " kr";
}

export default function CalendarWeekView({
  weekOffset,
  entries,
  redDays = [],
  onDayClick,
  onEntryClick,
  onPrev,
  onNext,
  getScheduledEntry,
  formatSecondary = defaultFormatSecondary,
}: Props) {
  const dates = getWeekDates(weekOffset);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const weekNum = getWeekNumber(new Date(dates[0] + "T12:00:00"));

  const redDayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of redDays) map.set(h.date, h.name);
    return map;
  }, [redDays]);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const totalSecondary = entries.reduce((sum, e) => sum + (e.secondaryValue ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="text-blue-600 hover:underline text-sm">
          &larr; Previous
        </button>
        <div className="text-center">
          <span className="text-lg font-semibold">Week {weekNum}</span>
          <span className="hidden sm:inline text-sm text-gray-500 ml-3">
            {dates[0]} — {dates[6]}
          </span>
        </div>
        <button onClick={onNext} className="text-blue-600 hover:underline text-sm">
          Next &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((d, i) => {
          const dayEntries = entries.filter((e) => e.date === d);
          const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0);
          const daySecondary = dayEntries.reduce(
            (sum, e) => sum + (e.secondaryValue ?? 0),
            0,
          );
          const isToday = d === today;
          const redDayName = redDayMap.get(d) ?? null;
          const isRedDay = redDayName !== null;
          const isSunday = i === 6 || isRedDay;
          const isSaturday = i === 5 && !isRedDay;
          const hasSick = dayEntries.some((e) => e.entryType === "sick");
          const schedEntry = getScheduledEntry ? getScheduledEntry(d, i) : null;

          return (
            <div
              key={d}
              onClick={() => onDayClick(d, dayEntries)}
              className={`p-2 rounded-lg border cursor-pointer transition-all min-h-[100px] ${
                isToday
                  ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200"
                  : isSunday
                    ? "bg-pink-50 border-pink-200"
                    : isSaturday
                      ? "bg-purple-50 border-purple-200"
                      : hasSick
                        ? "bg-red-50 border-red-200"
                        : dayTotal > 0
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-50 border-gray-200"
              } hover:shadow-md`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-500 font-medium">
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      : ""
                  }`}
                >
                  {parseInt(d.slice(8))}
                </span>
              </div>
              {redDayName && (
                <div
                  className="text-[10px] text-pink-600 font-medium leading-tight break-words"
                  title={redDayName}
                >
                  {redDayName}
                </div>
              )}
              {dayTotal > 0 && (
                <div className="mt-1">
                  <div
                    className={`text-lg font-bold ${
                      isToday
                        ? "text-indigo-600"
                        : isSunday
                          ? "text-pink-600"
                          : isSaturday
                            ? "text-purple-600"
                            : "text-blue-600"
                    }`}
                  >
                    {dayTotal.toFixed(2)}h
                  </div>
                  {daySecondary > 0 && (
                    <div className="text-xs text-gray-500">
                      {formatSecondary(daySecondary)}
                    </div>
                  )}
                </div>
              )}
              {dayEntries.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayEntries.slice(0, 2).map((entry) => (
                    <div
                      key={entry.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntryClick(entry);
                      }}
                      className="text-[10px] truncate px-1 py-0.5 rounded bg-white/60 hover:bg-white cursor-pointer"
                    >
                      {entry.startTime && entry.endTime
                        ? `${entry.startTime}-${entry.endTime}`
                        : `${entry.hours.toFixed(2)}h`}
                    </div>
                  ))}
                  {dayEntries.length > 2 && (
                    <div className="text-[10px] text-gray-400">
                      +{dayEntries.length - 2} more
                    </div>
                  )}
                </div>
              )}
              {dayTotal === 0 && schedEntry && (
                <div className="mt-1 border border-dashed border-gray-300 rounded px-1.5 py-1 bg-white/50">
                  <div className="text-[9px] text-gray-400">Scheduled</div>
                  <div className="text-[11px] text-gray-600 font-medium">
                    {schedEntry.startTime}-{schedEntry.endTime}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <span>
          Total:{" "}
          <strong className="text-blue-600">{totalHours.toFixed(2)}h</strong>
        </span>
        {totalSecondary > 0 && (
          <span>
            Sum:{" "}
            <strong className="text-green-600">
              {formatSecondary(totalSecondary)}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
