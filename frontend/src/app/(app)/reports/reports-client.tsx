"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useTimezone } from "@/hooks/use-timezone";
import { formatDate } from "@/lib/format-date";

interface Member { id: string; name: string }
interface Project { id: string; name: string }
interface ReportEntry {
  userId: string; userName: string;
  projectName: string;
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

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface Props {
  members: Member[];
  projects: Project[];
  isAdmin: boolean;
  currentUserId: string;
  accessToken: string;
}

export default function ReportsClient({ members, projects, isAdmin, currentUserId, accessToken }: Props) {
  const { timezone } = useTimezone();
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
    if (!res.ok) { setError("Failed to load report."); return; }
    setEntries(await res.json());
  }

  function handleExport() {
    const url = `${API_URL}/api/reports?${buildParams({ format: "csv" })}`;
    const a = document.createElement("a");
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.download = "time-report.csv";
        a.click();
      });
  }

  async function handleExportPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF();
    const blue: [number, number, number] = [30, 58, 138];

    doc.setFontSize(18);
    doc.setTextColor(20);
    doc.text("Time Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${from} to ${to}`, 14, 28);

    let curY = 38;

    if (summary.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text("Summary", 14, curY);
      curY += 6;
      autoTable(doc, {
        head: [isAdmin ? ["User", "Project", "Hours"] : ["Project", "Hours"]],
        body: summary.map((row) =>
          isAdmin
            ? [row.userName, row.projectName, formatHours(row.seconds)]
            : [row.projectName, formatHours(row.seconds)]
        ),
        startY: curY,
        headStyles: { fillColor: blue },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curY = (doc as any).lastAutoTable.finalY + 14;
    }

    if (entries && entries.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text(`Detailed Entries (${entries.length})`, 14, curY);
      curY += 6;
      autoTable(doc, {
        head: [
          isAdmin
            ? ["Date", "User", "Project", "Description", "Hours"]
            : ["Date", "Project", "Description", "Hours"],
        ],
        body: entries.map((e) =>
          isAdmin
            ? [formatDate(e.startedAt, timezone), e.userName, e.projectName, e.description || "—", formatHours(e.durationSeconds)]
            : [formatDate(e.startedAt, timezone), e.projectName, e.description || "—", formatHours(e.durationSeconds)]
        ),
        startY: curY,
        headStyles: { fillColor: blue },
        styles: { fontSize: 9 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curY = (doc as any).lastAutoTable.finalY + 8;
    }

    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Total: ${formatHours(totalSeconds)}`, 14, curY);
    doc.save(`time-report-${from}-to-${to}.pdf`);
  }

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
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="user-filter">User</Label>
              <NativeSelect id="user-filter" value={userId} onChange={(e) => setUserId(e.target.value)} className="h-9">
                <option value="">All members</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="project-filter">Project</Label>
            <NativeSelect id="project-filter" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Loading…" : "Run report"}
          </Button>
          {entries && entries.length > 0 && (
            <>
              <Button type="button" onClick={handleExport} variant="outline">
                Export CSV
              </Button>
              <Button type="button" onClick={handleExportPDF} variant="outline">
                Export PDF
              </Button>
            </>
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
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Project</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                      <th className="text-right px-6 py-3 font-medium text-gray-500">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.map((e, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3 whitespace-nowrap text-gray-600">{formatDate(e.startedAt, timezone)}</td>
                        {isAdmin && <td className="px-6 py-3">{e.userName}</td>}
                        <td className="px-6 py-3 font-medium">{e.projectName}</td>
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
