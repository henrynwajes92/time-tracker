"use client";

import { useState } from "react";

interface Project { id: string; name: string }

export interface TimeEntry {
  id: string;
  projectId?: string;
  projectName?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  description: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalNow(offsetMs = 0) {
  return toLocalDateTimeInput(new Date(Date.now() + offsetMs).toISOString());
}

interface Props {
  entries: TimeEntry[];
  projects: Project[];
  accessToken: string;
}

export default function EntriesClient({ entries: initial, projects, accessToken }: Props) {
  const [entries, setEntries] = useState(initial);

  // New entry form
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState(() => toLocalNow(-3600000));
  const [newEnd, setNewEnd] = useState(() => toLocalNow());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  function apiFetch(path: string, options: RequestInit = {}) {
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const res = await apiFetch("/api/time-entries/manual", {
      method: "POST",
      body: JSON.stringify({
        projectId: newProject,
        description: newDesc,
        startedAt: new Date(newStart).toISOString(),
        endedAt: new Date(newEnd).toISOString(),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? `Failed to log entry (${res.status}).`);
      return;
    }
    const entry: TimeEntry = await res.json();
    setEntries((prev) => [entry, ...prev]);
    setShowForm(false);
    setNewProject("");
    setNewDesc("");
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
    const res = await apiFetch(`/api/time-entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify({
        projectId: editProject,
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this time entry?")) return;
    const res = await apiFetch(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  function EditForm({ entryId }: { entryId: string }) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600">Description</label>
          <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="What did you work on?" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600">Project</label>
          <select value={editProject} onChange={(e) => setEditProject(e.target.value)} required className={inputCls}>
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600">Start time</label>
            <input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600">End time</label>
            <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={inputCls} />
          </div>
        </div>
        {editError && <p className="text-sm text-red-600">{editError}</p>}
        <div className="flex gap-2">
          <button onClick={() => handleUpdate(entryId)} disabled={editSaving}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {editSaving ? "Saving…" : "Save changes"}
          </button>
          <button onClick={() => setEditingId(null)} className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Log time manually"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
          <h2 className="font-medium mb-4">Log time entry</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <select value={newProject} onChange={(e) => setNewProject(e.target.value)} required className={inputCls}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start time</label>
                <input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End time</label>
                <input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} required className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What did you work on?" className={inputCls} />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save entry"}
              </button>
            </div>
          </form>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No time entries yet.</div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-3">
            {entries.map((e) =>
              editingId === e.id ? (
                <div key={e.id} className="bg-blue-50 rounded-xl border p-4">
                  <EditForm entryId={e.id} />
                </div>
              ) : (
                <div key={e.id} className="bg-white rounded-xl border shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {e.description || <span className="text-gray-400">No description</span>}
                      </p>
                      {e.projectName && <p className="text-xs text-blue-600 mt-0.5">● {e.projectName}</p>}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(e.startedAt).toLocaleDateString()} ·{" "}
                        {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="text-sm font-mono text-gray-600 shrink-0">
                      {e.durationSeconds != null ? formatDuration(e.durationSeconds) : "—"}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-3 pt-3 border-t">
                    <button onClick={() => startEdit(e)} className="text-blue-600 text-sm hover:underline">Edit</button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-600 text-sm hover:underline">Delete</button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-white rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Project</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Duration</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) =>
                  editingId === e.id ? (
                    <tr key={e.id} className="bg-blue-50">
                      <td colSpan={5} className="px-6 py-4">
                        <EditForm entryId={e.id} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {new Date(e.startedAt).toLocaleDateString()}{" "}
                        {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {e.description || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-blue-600 text-xs font-medium">
                        {e.projectName ?? "—"}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {e.durationSeconds != null ? formatDuration(e.durationSeconds) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button onClick={() => startEdit(e)} className="text-blue-600 hover:underline text-sm">Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:underline text-sm">Delete</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
