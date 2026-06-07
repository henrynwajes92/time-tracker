"use client";

import { useState, useEffect, useRef } from "react";

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

function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function groupByDay(entries: TimeEntry[]): DayGroup[] {
  // show this week (Mon–Sun)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const thisWeek = entries.filter((e) => new Date(e.startedAt) >= weekStart);

  const groups: Record<string, DayGroup> = {};
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (const e of thisWeek) {
    const dateStr = new Date(e.startedAt).toISOString().slice(0, 10);
    let label: string;
    if (dateStr === todayStr) label = "Today";
    else if (dateStr === yesterdayStr) label = "Yesterday";
    else {
      const d = new Date(e.startedAt);
      label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    if (!groups[dateStr]) {
      groups[dateStr] = { dateStr, label, entries: [], totalSeconds: 0 };
    }
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
    setEditStart(entry.startedAt ? toLocalDateTimeInput(entry.startedAt) : "");
    setEditEnd(entry.endedAt ? toLocalDateTimeInput(entry.endedAt) : "");
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
        startedAt: new Date(editStart).toISOString(),
        endedAt: new Date(editEnd).toISOString(),
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

  const groups = groupByDay(entries);
  const weekTotal = groups.reduce((s, g) => s + g.totalSeconds, 0);
  const selectedProjectName = projects.find((p) => p.id === selectedProject)?.name;
  const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

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
              <button
                onClick={handleStop}
                disabled={loading}
                className="bg-red-500 text-white px-3 sm:px-5 py-2 rounded text-sm font-semibold hover:bg-red-600 disabled:opacity-50 shrink-0"
              >
                {loading ? "…" : "STOP"}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={loading || !selectedProject}
                className="bg-blue-600 text-white px-3 sm:px-5 py-2 rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {loading ? "…" : "START"}
              </button>
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
                {/* Day header */}
                <div className="flex items-center justify-between py-2 mt-2">
                  <span className="text-sm text-gray-500 font-medium">{group.label}</span>
                  <span className="text-sm text-gray-500">
                    Total:{" "}
                    <span className="font-semibold text-gray-900">{formatHHMMSS(group.totalSeconds)}</span>
                  </span>
                </div>

                {/* Entries */}
                <div className="border rounded-xl overflow-hidden mb-3">
                  {group.entries.map((entry, idx) =>
                    editingId === entry.id ? (
                      <div key={entry.id} className={`bg-blue-50 p-4 ${idx > 0 ? "border-t" : ""}`}>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium mb-1 text-gray-600">Description</label>
                            <input
                              value={editDesc}
                              onChange={(ev) => setEditDesc(ev.target.value)}
                              placeholder="What did you work on?"
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1 text-gray-600">Project</label>
                            <select value={editProject} onChange={(ev) => setEditProject(ev.target.value)} className={inputCls}>
                              <option value="">No project</option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-600">Start</label>
                              <input type="datetime-local" value={editStart} onChange={(ev) => setEditStart(ev.target.value)} className={inputCls} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-600">End</label>
                              <input type="datetime-local" value={editEnd} onChange={(ev) => setEditEnd(ev.target.value)} className={inputCls} />
                            </div>
                          </div>
                          {editError && <p className="text-sm text-red-600">{editError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdate(entry.id)}
                              disabled={editSaving}
                              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              {editSaving ? "Saving…" : "Save changes"}
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 sm:gap-4 px-4 py-3 bg-white hover:bg-gray-50 group ${idx > 0 ? "border-t" : ""}`}
                      >
                        {/* Description + project */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.description || <span className="text-gray-400 font-normal">No description</span>}
                          </p>
                          {entry.projectName && (
                            <p className="text-xs text-blue-600 font-medium mt-0.5">● {entry.projectName}</p>
                          )}
                        </div>

                        {/* Time range */}
                        <span className="hidden sm:block text-sm text-gray-400 shrink-0 tabular-nums">
                          {new Date(entry.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" – "}
                          {entry.endedAt
                            ? new Date(entry.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "…"}
                        </span>

                        {/* Duration */}
                        <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                          {entry.durationSeconds != null ? formatHHMMSS(entry.durationSeconds) : "—"}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(entry)}
                            className="text-gray-400 hover:text-blue-600 text-xs px-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-gray-400 hover:text-red-500 text-xs px-1"
                          >
                            Delete
                          </button>
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
