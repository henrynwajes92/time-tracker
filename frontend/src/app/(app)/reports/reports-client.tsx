"use client";

import { useState } from "react";

interface Member { id: string; name: string }
interface Project { id: string; name: string }
interface ReportEntry {
  userId: string; userName: string;
  projectName: string; taskName: string;
  description: string; startedAt: string;
  durationSeconds: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

function formatHours(seconds: number) {
  return (seconds / 3600).toFixed(2) + "h";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

interface Props {
  members: Member[];
  projects: Project[];
  isAdmin: boolean;
  currentUserId: string;
  accessToken: string;
}

export default function ReportsClient({ members, projects, isAdmin, currentUserId, accessToken }: Props) {
  const [from, setFrom] = useState(weekStartStr());
  const [to, setTo] = useState(todayStr());
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [entries, setEntries] = useState<ReportEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function buildParams(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", new Date(new Date(to).getTime() + 86400000).toISOString().slice(0, 10));
    if (isAdmin && userId) params.set("userId", userId);
    if (projectId) params.set("projectId", projectId);
    if (extra) Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params.toString();
  }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`${API_URL}/api/reports?${buildParams()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setLoading(false);

    if (!res.ok) {
      setError("Failed to load report.");
      return;
    }

    setEntries(await res.json());
  }

  function handleExport() {
    const url = `${API_URL}/api/reports?${buildParams({ format: "csv" })}`;
    const a = document.createElement("a");
    a.href = url;
    // Can't set auth header via anchor — fetch blob instead
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.download = "time-report.csv";
        a.click();
      });
  }

  // Summarise by user+project
  const summary = entries
    ? Object.values(
        entries.reduce<Record<string, { userName: string; projectName: string; seconds: number }>>((acc, e) => {
          const key = `${e.userId}|${e.projectName}`;
          if (!acc[key]) acc[key] = { userName: e.userName, projectName: e.projectName, seconds: 0 };
          acc[key].seconds += e.durationSeconds;
          return acc;
        }, {})
      )
    : [];

  const totalSeconds = entries?.reduce((s, e) => s + e.durationSeconds, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <form onSubmit={handleRun} className="bg-white rounded-xl border shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium mb-1">User</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All members</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Loading…" : "Run report"}
          </button>
          {entries && entries.length > 0 && (
            <button type="button" onClick={handleExport}
              className="border px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50">
              Export CSV
            </button>
          )}
        </div>
      </form>

      {entries !== null && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="font-medium">Summary</h2>
              <span className="text-sm text-gray-500">Total: <strong>{formatHours(totalSeconds)}</strong></span>
            </div>
            {summary.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">No entries found for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {isAdmin && <th className="text-left px-6 py-3 font-medium text-gray-500">User</th>}
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Project</th>
                    <th className="text-right px-6 py-3 font-medium text-gray-500">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.map((row, i) => (
                    <tr key={i}>
                      {isAdmin && <td className="px-6 py-3">{row.userName}</td>}
                      <td className="px-6 py-3">{row.projectName}</td>
                      <td className="px-6 py-3 text-right font-mono">{formatHours(row.seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Detail */}
          {entries.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-medium">Detail ({entries.length} entries)</h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                    {isAdmin && <th className="text-left px-6 py-3 font-medium text-gray-500">User</th>}
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Project / Task</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                    <th className="text-right px-6 py-3 font-medium text-gray-500">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600">{new Date(e.startedAt).toLocaleDateString()}</td>
                      {isAdmin && <td className="px-6 py-3">{e.userName}</td>}
                      <td className="px-6 py-3">
                        <span className="font-medium">{e.projectName}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        {e.taskName}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{e.description || "—"}</td>
                      <td className="px-6 py-3 text-right font-mono">{formatHours(e.durationSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
