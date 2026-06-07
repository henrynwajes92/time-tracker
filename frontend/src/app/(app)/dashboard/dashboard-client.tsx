"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useTimezone } from "@/hooks/use-timezone";
import { formatTime, toLocalInputValue, fromLocalInputValue } from "@/lib/format-date";

interface Project { id: string; name: string }
export interface TimeEntry {
  id: string;
  projectId?: string;
  projectName: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  description: string;
}

interface DayGroup {
  dateStr: string;
  label: string;
  entries: TimeEntry[];
  totalSeconds: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

function formatHHMMSS(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function tzDateStr(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

function groupByDay(entries: TimeEntry[], timezone: string): DayGroup[] {
  const now = new Date();
  const todayStr = tzDateStr(now.toISOString(), timezone);
  const yesterdayStr = tzDateStr(new Date(Date.now() - 86400000).toISOString(), timezone);

  // Show last 7 days
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const recent = entries.filter((e) => new Date(e.startedAt) >= cutoff);

  const groups: Record<string, DayGroup> = {};
  for (const e of recent) {
    const dateStr = tzDateStr(e.startedAt, timezone);
    let label: string;
    if (dateStr === todayStr) label = "Today";
    else if (dateStr === yesterdayStr) label = "Yesterday";
    else {
      label = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short", month: "short", day: "numeric",
      }).format(new Date(e.startedAt));
    }
    if (!groups[dateStr]) groups[dateStr] = { dateStr, label, entries: [], totalSeconds: 0 };
    groups[dateStr].entries.push(e);
    groups[dateStr].totalSeconds += e.durationSeconds ?? 0;
  }

  return Object.values(groups).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
}

interface Props {
  projects: Project[];
  initialEntries: TimeEntry[];
  initialActive: TimeEntry | null;
  accessToken: string;
}

export default function DashboardClient({ projects, initialEntries, initialActive, accessToken }: Props) {
  const { timezone } = useTimezone();
  const [active, setActive] = useState<TimeEntry | null>(initialActive);
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [elapsed, setElapsed] = useState(() => {
    if (!initialActive) return 0;
    return Math.floor((Date.now() - new Date(initialActive.startedAt).getTime()) / 1000);
  });
  const [description, setDescription] = useState(initialActive?.description ?? "");
  const [selectedProject, setSelectedProject] = useState(initialActive?.projectId ?? "");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [!!active]);

  function fetchWithToken(path: string, options: RequestInit = {}) {
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  }

  async function handleStart() {
    if (!selectedProject) { setError("Please select a project first."); return; }
    setLoading(true);
    setError("");
    const res = await fetchWithToken("/api/time-entries", {
      method: "POST",
      body: JSON.stringify({ projectId: selectedProject, description }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to start timer.");
      return;
    }
    const entry: TimeEntry = await res.json();
    setActive(entry);
    setElapsed(0);
  }

  async function handleStop() {
    if (!active) return;
    setLoading(true);
    const res = await fetchWithToken(`/api/time-entries/${active.id}/stop`, { method: "POST" });
    setLoading(false);
    if (!res.ok) { setError("Failed to stop timer."); return; }
    const stopped: TimeEntry = await res.json();
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(null);
    setElapsed(0);
    setDescription("");
    setSelectedProject("");
    setEntries((prev) => [stopped, ...prev]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this time entry?")) return;
    const res = await fetchWithToken(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditDesc(entry.description ?? "");
    setEditProject(entry.projectId ?? "");
    setEditStart(entry.startedAt ? toLocalInputValue(entry.startedAt, timezone) : "");
    setEditEnd(entry.endedAt ? toLocalInputValue(entry.endedAt, timezone) : "");
    setEditError("");
  }

  async function handleUpdate(entryId: string) {
    setEditSaving(true);
    setEditError("");
    const res = await fetchWithToken(`/api/time-entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify({
        projectId: editProject || (projects[0]?.id ?? ""),
        description: editDesc,
        startedAt: fromLocalInputValue(editStart, timezone),
        endedAt: fromLocalInputValue(editEnd, timezone),
      }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? `Update failed (${res.status}).`);
      return;
    }
    const updated: TimeEntry = await res.json();
    setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    setEditingId(null);
  }

  const groups = groupByDay(entries, timezone);
  const weekTotal = groups.reduce((s, g) => s + g.totalSeconds, 0);
  const selectedProjectName = projects.find((p) => p.id === selectedProject)?.name;

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky timer bar */}
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b shadow-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Description */}
            <input
              value={active ? (active.description || "Timer running…") : description}
              onChange={(e) => !active && setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !active && handleStart()}
              placeholder="What are you working on?"
              readOnly={!!active}
              className="flex-1 text-sm border-0 outline-none bg-transparent placeholder-gray-400 min-w-0"
            />

            {/* Project selector */}
            {!active ? (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowProjectMenu((v) => !v)}
                  className={`flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                    selectedProject
                      ? "border-blue-500 text-blue-600 bg-blue-50"
                      : "border-gray-300 text-gray-500 hover:border-blue-400"
                  }`}
                >
                  {selectedProjectName ?? "+ Project"}
                </button>
                {showProjectMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border rounded-lg shadow-lg z-30 py-1 max-h-52 overflow-y-auto">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProject(p.id); setShowProjectMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedProject === p.id ? "text-blue-600 font-medium" : ""}`}
                      >
                        {p.name}
                      </button>
                    ))}
                    {selectedProject && (
                      <button
                        onClick={() => { setSelectedProject(""); setShowProjectMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-t"
                      >
                        Clear project
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 shrink-0 whitespace-nowrap">
                {active.projectName || "—"}
              </span>
            )}

            {/* Timer display */}
            <span className="font-mono text-sm sm:text-base tabular-nums text-gray-800 w-16 sm:w-20 text-right shrink-0">
              {formatHHMMSS(elapsed)}
            </span>

            {/* Start / Stop */}
            {active ? (
              <Button
                onClick={handleStop}
                disabled={loading}
                variant="destructive"
                className="shrink-0 px-3 sm:px-5"
              >
                {loading ? "…" : "STOP"}
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={loading || !selectedProject}
                className="shrink-0 px-3 sm:px-5"
              >
                {loading ? "…" : "START"}
              </Button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {/* Close project menu overlay */}
      {showProjectMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowProjectMenu(false)} />
      )}

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6">
        {groups.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-base font-medium">No time entries this week</p>
            <p className="text-sm mt-1">Select a project above and press START to begin tracking.</p>
          </div>
        ) : (
          <>
            {/* Week header */}
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-sm font-semibold text-blue-600">This week</span>
              <span className="text-sm text-gray-500">
                Week total:{" "}
                <span className="font-bold text-gray-900">{formatHHMMSS(weekTotal)}</span>
              </span>
            </div>

            {groups.map((group) => (
              <div key={group.dateStr}>
                <div className="flex items-center justify-between py-2 mt-2">
                  <span className="text-sm text-gray-500 font-medium">{group.label}</span>
                  <span className="text-sm text-gray-500">
                    Total:{" "}
                    <span className="font-semibold text-gray-900">{formatHHMMSS(group.totalSeconds)}</span>
                  </span>
                </div>

                <div className="border rounded-xl overflow-hidden mb-3">
                  {group.entries.map((entry, idx) =>
                    editingId === entry.id ? (
                      <div key={entry.id} className={`bg-blue-50 p-4 ${idx > 0 ? "border-t" : ""}`}>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Input
                              value={editDesc}
                              onChange={(ev) => setEditDesc(ev.target.value)}
                              placeholder="What did you work on?"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Project</Label>
                            <NativeSelect
                              value={editProject}
                              onChange={(ev) => setEditProject(ev.target.value)}
                              className="h-9"
                            >
                              <option value="">No project</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </NativeSelect>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label>Start</Label>
                              <Input
                                type="datetime-local"
                                value={editStart}
                                onChange={(ev) => setEditStart(ev.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>End</Label>
                              <Input
                                type="datetime-local"
                                value={editEnd}
                                onChange={(ev) => setEditEnd(ev.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          {editError && <p className="text-sm text-red-600">{editError}</p>}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleUpdate(entry.id)}
                              disabled={editSaving}
                              size="sm"
                            >
                              {editSaving ? "Saving…" : "Save changes"}
                            </Button>
                            <Button
                              onClick={() => setEditingId(null)}
                              variant="outline"
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 sm:gap-4 px-4 py-3 bg-white hover:bg-gray-50 group ${idx > 0 ? "border-t" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.description || <span className="text-gray-400 font-normal">No description</span>}
                          </p>
                          {entry.projectName && (
                            <p className="text-xs text-blue-600 font-medium mt-0.5">● {entry.projectName}</p>
                          )}
                        </div>

                        <span className="hidden sm:block text-sm text-gray-400 shrink-0 tabular-nums">
                          {formatTime(entry.startedAt, timezone)}
                          {" – "}
                          {entry.endedAt ? formatTime(entry.endedAt, timezone) : "…"}
                        </span>

                        <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                          {entry.durationSeconds != null ? formatHHMMSS(entry.durationSeconds) : "—"}
                        </span>

                        <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            onClick={() => startEdit(entry)}
                            variant="ghost"
                            size="xs"
                            className="text-gray-400 hover:text-blue-600"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDelete(entry.id)}
                            variant="ghost"
                            size="xs"
                            className="text-gray-400 hover:text-red-500"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
