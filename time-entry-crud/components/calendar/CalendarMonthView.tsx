"use client";

import { useMemo } from "react";
import { getWeekNumber } from "../../lib/time-utils";

export interface CalendarEntry {
  id: number;
  date: string;
  hours: number;
  startTime: string | null;
  endTime: string | null;
  entryType: string;
  /** Free-form label rendered on the entry chip (e.g. project name). */
  label?: string;
  /** Optional secondary metric — rendered next to the hours. */
  secondaryValue?: number;
}

export interface ScheduleEntry {
  dayOfWeek: number; // 0 = Monday
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface RedDayInfo {
  date: string;
  name: string;
}

interface Props {
  year: number;
  month: number; // 0-indexed
  entries: CalendarEntry[];
  /** Pass a list of red-day dates if you want them highlighted (e.g. from swedish-tax-holidays). */
  redDays?: RedDayInfo[];
  onDayClick: (date: string, entries: CalendarEntry[]) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onPrev: () => void;
  onNext: () => void;
  /** Optional weekly schedule lookup — `(date, dayOfWeek) => entry | null`. */
  getScheduledEntry?: (date: string, dayOfWeek: number) => ScheduleEntry | null;
  /** Format a secondary value (e.g. for currency). Default: integer + " kr". */
  formatSecondary?: (value: number) => string;
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function defaultFormatSecondary(amount: number): string {
  return Math.round(amount).toLocaleString() + " kr";
}

export default function CalendarMonthView({
  year,
  month,
  entries,
  redDays = [],
  onDayClick,
  onEntryClick,
  onPrev,
  onNext,
  getScheduledEntry,
  formatSecondary = defaultFormatSecondary,
}: Props) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const redDayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of redDays) map.set(h.date, h.name);
    return map;
  }, [redDays]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const weeks: (string | null)[][] = [];
  let currentWeek: (string | null)[] = new Array(startDow).fill(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    currentWeek.push(dateStr);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const totalSecondary = entries.reduce((sum, e) => sum + (e.secondaryValue ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="text-blue-600 hover:underline text-sm">
          &larr; Previous
        </button>
        <span className="text-lg font-semibold">
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={onNext} className="text-blue-600 hover:underline text-sm">
          Next &rarr;
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="border rounded-lg overflow-hidden min-w-[340px]">
          <div className="grid grid-cols-8 bg-gray-100 border-b">
            <div className="p-2 text-xs font-medium text-gray-500 text-center">W</div>
            {DAY_HEADERS.map((d) => (
              <div key={d} className="p-2 text-xs font-medium text-gray-500 text-center">
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => {
            const firstDateInWeek = week.find((d) => d !== null);
            const weekNum = firstDateInWeek
              ? getWeekNumber(new Date(firstDateInWeek + "T12:00:00"))
              : "";

            return (
              <div key={wi} className="grid grid-cols-8 border-b last:border-b-0">
                <div className="p-1 text-xs text-gray-400 text-center flex items-start justify-center pt-2">
                  {weekNum}
                </div>
                {week.map((dateStr, di) => {
                  if (!dateStr)
                    return <div key={di} className="p-1 bg-gray-50 min-h-[60px]" />;

                  const dayEntries = entries.filter((e) => e.date === dateStr);
                  const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0);
                  const daySecondary = dayEntries.reduce(
                    (sum, e) => sum + (e.secondaryValue ?? 0),
                    0,
                  );
                  const isToday = dateStr === today;
                  const redDayName = redDayMap.get(dateStr) ?? null;
                  const isRedDay = redDayName !== null;
                  const isSunday = di === 6 || isRedDay;
                  const isSaturday = di === 5 && !isRedDay;
                  const dayNum = parseInt(dateStr.slice(8));
                  const schedEntry = getScheduledEntry
                    ? getScheduledEntry(dateStr, di)
                    : null;
                  const hasScheduleOnly = dayTotal === 0 && schedEntry !== null;

                  return (
                    <div
                      key={di}
                      onClick={() => onDayClick(dateStr, dayEntries)}
                      className={`p-1 min-h-[60px] cursor-pointer border-l transition-colors ${
                        isToday
                          ? "bg-indigo-50"
                          : isSunday
                            ? "bg-pink-50/50"
                            : isSaturday
                              ? "bg-purple-50/50"
                              : hasScheduleOnly
                                ? "hover:bg-gray-100"
                                : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium mb-0.5 ${
                          isToday
                            ? "bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                            : isSunday
                              ? "text-pink-600"
                              : isSaturday
                                ? "text-purple-600"
                                : "text-gray-700"
                        }`}
                      >
                        {dayNum}
                      </div>

                      {redDayName && (
                        <div
                          className="text-[8px] text-pink-600 font-medium leading-tight break-words"
                          title={redDayName}
                        >
                          {redDayName}
                        </div>
                      )}

                      {dayEntries.length > 0 && (
                        <div className="space-y-0.5">
                          {dayEntries.slice(0, 2).map((entry) => (
                            <div
                              key={entry.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEntryClick(entry);
                              }}
                              className="cursor-pointer hover:bg-white/60 rounded px-0.5"
                            >
                              {entry.startTime && entry.endTime && (
                                <div
                                  className={`text-[9px] font-medium leading-[1.1] ${
                                    isToday
                                      ? "text-indigo-700"
                                      : isSunday
                                        ? "text-pink-700"
                                        : isSaturday
                                          ? "text-purple-700"
                                          : "text-gray-700"
                                  }`}
                                >
                                  <div>{entry.startTime}</div>
                                  <div>-{entry.endTime}</div>
                                </div>
                              )}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span
                                  className={`text-[9px] font-bold ${
                                    isToday
                                      ? "text-indigo-600"
                                      : isSunday
                                        ? "text-pink-600"
                                        : isSaturday
                                          ? "text-purple-600"
                                          : "text-blue-600"
                                  }`}
                                >
                                  {entry.hours.toFixed(2)}h
                                </span>
                                {(entry.secondaryValue ?? 0) > 0 && (
                                  <span className="text-[8px] text-green-700">
                                    {formatSecondary(entry.secondaryValue!)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {dayEntries.length > 2 && (
                            <div className="text-[8px] text-gray-400 pl-0.5">
                              +{dayEntries.length - 2} more
                            </div>
                          )}
                          {dayEntries.length > 1 && (
                            <div className="text-[8px] text-gray-500 border-t border-gray-100 pt-0.5 pl-0.5">
                              <span className="font-medium">{dayTotal.toFixed(2)}h</span>
                              {daySecondary > 0 && (
                                <span className="text-green-700 ml-1">
                                  {formatSecondary(daySecondary)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {hasScheduleOnly && (
                        <div className="mt-0.5 border border-dashed border-gray-300 rounded px-1 py-0.5 bg-white/60">
                          <div className="text-[8px] text-gray-400 leading-none">
                            Scheduled
                          </div>
                          <div className="text-[9px] text-gray-500 font-medium leading-tight">
                            {schedEntry!.startTime}-{schedEntry!.endTime}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <span>
          Total: <strong className="text-blue-600">{totalHours.toFixed(2)}h</strong>
        </span>
        <span>{entries.length} entries</span>
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
