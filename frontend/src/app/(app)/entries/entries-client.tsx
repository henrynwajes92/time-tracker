"use client";

import { useState } from "react";
import { TimeEntry } from "./page";

interface Task { id: string; name: string; projectId: string }
interface Project { id: string; name: string; tasks: Task[] }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

async function fetchWithToken(path: string, options: RequestInit = {}) {
  const session = await fetch("/api/auth/session").then((r) => r.json());
  const token = session?.accessToken;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface Props {
  entries: TimeEntry[];
  projects: Project[];
}

export default function EntriesClient({ entries: initial, projects }: Props) {
  const [entries, setEntries] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState(() => toLocalDateTimeInput(new Date(Date.now() - 3600000)));
  const [endedAt, setEndedAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableTasks = projects.find((p) => p.id === selectedProject)?.tasks ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetchWithToken("/api/time-entries/manual", {
      method: "POST",
      body: JSON.stringify({
        taskId: selectedTask,
        description,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to log entry.");
      return;
    }

    const entry: TimeEntry = await res.json();
    setEntries((prev) => [entry, ...prev]);
    setShowForm(false);
    setSelectedProject("");
    setSelectedTask("");
    setDescription("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this time entry?")) return;
    const res = await fetchWithToken(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          {showForm ? "Cancel" : "Log time manually"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-medium mb-4">Log time entry</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => { setSelectedProject(e.target.value); setSelectedTask(""); }}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Task</label>
                <select
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  required
                  disabled={!selectedProject}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50"
                >
                  <option value="">Select task…</option>
                  {availableTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start time</label>
                <input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End time</label>
                <input
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you work on?"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                {saving ? "Saving…" : "Save entry"}
              </button>
            </div>
          </form>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No time entries yet.</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Duration</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                    {new Date(e.startedAt).toLocaleDateString()} {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{e.description || <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4 font-mono">{e.durationSeconds != null ? formatDuration(e.durationSeconds) : "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:underline text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
