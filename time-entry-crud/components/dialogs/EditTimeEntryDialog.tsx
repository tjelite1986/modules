"use client";

import { useState, useEffect } from "react";
import DatePicker from "../DatePicker";
import TimePicker from "../TimePicker";
import TaskSegmentEditor from "../TaskSegmentEditor";
import {
  TaskSegment,
  parseTaskSegments,
  serializeTaskSegments,
} from "../../lib/task-segments";
import { BreakPeriod, sumBreakMinutes } from "../../lib/break-periods";
import { generateBreakPeriod } from "../../lib/time-utils";

export interface TimeEntryDetail {
  id: number;
  projectId?: number | null;
  date: string;
  hours: number;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  breakPeriods?: BreakPeriod[] | null;
  entryType: string;
  overtimeType: string;
  description: string | null;
  taskSegments: string | null;
}

export interface ProjectOption {
  id: number;
  name: string;
}

export type OvertimeOption = { value: string; label: string };
export type EntryTypeOption = { value: string; label: string };

interface Props {
  entry: TimeEntryDetail | null;
  /** Optional project list. Hide the project picker entirely if empty. */
  projects?: ProjectOption[];
  /** Optional department list for task segments. */
  departments?: string[];
  /** Override the entry-type options. Default: work + sick. */
  entryTypeOptions?: EntryTypeOption[];
  /** Override the overtime options. Default: none + Swedish handels-style. */
  overtimeOptions?: OvertimeOption[];
  /** Endpoint to PUT the update to. Default: /api/time-entries */
  endpoint?: string;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_ENTRY_TYPES: EntryTypeOption[] = [
  { value: "work", label: "Work" },
  { value: "sick", label: "Sick day" },
];

const DEFAULT_OVERTIME_OPTIONS: OvertimeOption[] = [
  { value: "none", label: "None" },
  { value: "mertid", label: "Extra time (+35%)" },
  { value: "enkel", label: "Single overtime (+35%)" },
  { value: "kvalificerad", label: "Qualified overtime (+70%)" },
];

function calcHoursPreview(
  startTime: string,
  endTime: string,
  breakMin: number,
): string {
  if (!startTime || !endTime) return "";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 1440;
  const total = (endMinutes - startMinutes - breakMin) / 60;
  return total > 0 ? total.toFixed(2) : "0";
}

export default function EditTimeEntryDialog({
  entry,
  projects = [],
  departments = [],
  entryTypeOptions = DEFAULT_ENTRY_TYPES,
  overtimeOptions = DEFAULT_OVERTIME_OPTIONS,
  endpoint = "/api/time-entries",
  onClose,
  onSaved,
}: Props) {
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriod[]>([]);
  const [entryType, setEntryType] = useState("work");
  const [overtimeType, setOvertimeType] = useState("none");
  const [description, setDescription] = useState("");
  const [taskSegments, setTaskSegments] = useState<TaskSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!entry) return;
    setProjectId(entry.projectId ? String(entry.projectId) : "");
    setDate(entry.date);
    setStartTime(entry.startTime || "");
    setEndTime(entry.endTime || "");
    if (entry.breakPeriods && entry.breakPeriods.length > 0) {
      setBreakPeriods(entry.breakPeriods);
    } else if (
      entry.breakMinutes &&
      entry.breakMinutes > 0 &&
      entry.startTime &&
      entry.endTime
    ) {
      setBreakPeriods([
        generateBreakPeriod(entry.startTime, entry.endTime, entry.breakMinutes),
      ]);
    } else {
      setBreakPeriods([]);
    }
    setEntryType(entry.entryType);
    setOvertimeType(entry.overtimeType);
    setDescription(entry.description || "");
    setTaskSegments(parseTaskSegments(entry.taskSegments));
  }, [entry]);

  if (!entry) return null;

  const totalBreakMinutes = sumBreakMinutes(breakPeriods);
  const previewHours = calcHoursPreview(startTime, endTime, totalBreakMinutes);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const validPeriods = breakPeriods.filter((bp) => bp.start && bp.end);
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry!.id,
          projectId: projectId ? parseInt(projectId) : undefined,
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          ...(validPeriods.length > 0
            ? { breakPeriods: validPeriods }
            : { breakMinutes: startTime && endTime ? 0 : undefined }),
          entryType,
          overtimeType,
          description: description || undefined,
          taskSegments: serializeTaskSegments(taskSegments),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not save");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold">Edit time entry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
          )}

          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start time
              </label>
              <TimePicker
                value={startTime}
                onChange={setStartTime}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End time
              </label>
              <TimePicker
                value={endTime}
                onChange={setEndTime}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Breaks
            </label>
            <div className="space-y-1">
              {breakPeriods.map((bp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <TimePicker
                    value={bp.start}
                    onChange={(v) =>
                      setBreakPeriods((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, start: v } : p)),
                      )
                    }
                    placeholder="Start"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-gray-400 text-sm">-</span>
                  <TimePicker
                    value={bp.end}
                    onChange={(v) =>
                      setBreakPeriods((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, end: v } : p)),
                      )
                    }
                    placeholder="End"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBreakPeriods((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-red-500 hover:text-red-700 text-xs px-1 flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {breakPeriods.length === 0 && (
                <p className="text-xs text-gray-400">No break</p>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() =>
                  setBreakPeriods((prev) => [...prev, { start: "", end: "" }])
                }
                className="text-xs text-blue-600 hover:underline"
              >
                + Add break
              </button>
              {breakPeriods.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBreakPeriods([])}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  No break
                </button>
              )}
            </div>
            {totalBreakMinutes > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Total: {totalBreakMinutes} min
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {entryTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overtime
            </label>
            <select
              value={overtimeType}
              onChange={(e) => setOvertimeType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {overtimeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {departments.length > 0 && (
            <TaskSegmentEditor
              segments={taskSegments}
              onChange={setTaskSegments}
              departments={departments}
              passStart={startTime}
              passEnd={endTime}
            />
          )}

          {previewHours && (
            <p className="text-sm text-gray-600">
              Calculated hours:{" "}
              <strong className="text-blue-600">{previewHours}h</strong>
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
