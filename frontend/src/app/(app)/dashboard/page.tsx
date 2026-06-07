import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import ActiveTimerBanner from "./active-timer-banner";

interface DayStats { date: string; seconds: number }
interface TimeEntry {
  id: string; taskId: string; startedAt: string;
  endedAt?: string; durationSeconds?: number; description: string;
}
interface DashboardData {
  activeTimer: TimeEntry | null;
  todaySeconds: number;
  weekSeconds: number;
  weekDays: DayStats[];
  recentEntries: TimeEntry[];
}

function formatHours(seconds: number) {
  const h = seconds / 3600;
  return h.toFixed(1) + "h";
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const data = await api.get<DashboardData>("/api/dashboard");
  const maxDay = Math.max(...data.weekDays.map((d) => d.seconds), 1);

  // Build Mon–Sun grid (ISO week starts Monday)
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon
  const weekGrid = DAY_LABELS.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = data.weekDays.find((s) => s.date === dateStr);
    return { label, date: dateStr, seconds: found?.seconds ?? 0 };
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {session.user.name}</p>
      </div>

      {/* Active timer banner */}
      {data.activeTimer && (
        <ActiveTimerBanner entry={data.activeTimer} />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <p className="text-sm text-gray-500">Today</p>
          <p className="text-3xl font-semibold mt-1">{formatHours(data.todaySeconds)}</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <p className="text-sm text-gray-500">This week</p>
          <p className="text-3xl font-semibold mt-1">{formatHours(data.weekSeconds)}</p>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="bg-white rounded-xl border shadow-sm p-6 max-w-2xl">
        <h2 className="font-medium mb-4">This week</h2>
        <div className="flex items-end gap-3 h-32">
          {weekGrid.map((day) => {
            const heightPct = (day.seconds / maxDay) * 100;
            const isToday = day.date === today.toISOString().slice(0, 10);
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "96px" }}>
                  <div
                    className={`w-full rounded-t transition-all ${isToday ? "bg-blue-600" : "bg-blue-100"}`}
                    style={{ height: `${Math.max(heightPct, day.seconds > 0 ? 4 : 0)}%` }}
                    title={day.seconds > 0 ? formatDuration(day.seconds) : "No entries"}
                  />
                </div>
                <span className={`text-xs ${isToday ? "font-semibold" : "text-gray-500"}`}>{day.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent entries */}
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Recent entries</h2>
          <Link href="/entries" className="text-sm text-gray-500 hover:underline">View all</Link>
        </div>

        {data.recentEntries.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm px-6 py-8 text-center text-gray-400 text-sm">
            No entries yet.{" "}
            <Link href="/timer" className="underline">Start your first timer</Link> or{" "}
            <Link href="/entries" className="underline">log time manually</Link>.
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {data.recentEntries.map((e) => (
              <div key={e.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{e.description || <span className="text-gray-400">No description</span>}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(e.startedAt).toLocaleDateString()} · {new Date(e.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="text-sm font-mono text-gray-600">
                  {e.durationSeconds != null ? formatDuration(e.durationSeconds) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
