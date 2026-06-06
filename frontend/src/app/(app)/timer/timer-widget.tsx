"use client";

import { useEffect, useRef, useState } from "react";

interface Task { id: string; name: string; projectId: string }
interface Project { id: string; name: string; tasks: Task[] }
interface TimeEntry {
  id: string; taskId: string; startedAt: string;
  endedAt?: string; durationSeconds?: number; description: string;
}

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
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

interface Props {
  projects: Project[];
  initialActive: TimeEntry | null;
}

export default function TimerWidget({ projects, initialActive }: Props) {
  const [active, setActive] = useState<TimeEntry | null>(initialActive);
  const [elapsed, setElapsed] = useState(() => {
    if (!initialActive) return 0;
    return Math.floor((Date.now() - new Date(initialActive.startedAt).getTime()) / 1000);
  });
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableTasks = projects.find((p) => p.id === selectedProject)?.tasks ?? [];

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  async function handleStart() {
    if (!selectedTask) { setError("Select a project and task first."); return; }
    setLoading(true);
    setError("");

    const res = await fetchWithToken("/api/time-entries", {
      method: "POST",
      body: JSON.stringify({ taskId: selectedTask, description }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
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

    const res = await fetchWithToken(`/api/time-entries/${active.id}/stop`, {
      method: "POST",
    });

    setLoading(false);

    if (!res.ok) {
      setError("Failed to stop timer.");
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(null);
    setElapsed(0);
    setSelectedProject("");
    setSelectedTask("");
    setDescription("");
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-8 space-y-6">
      {/* Clock display */}
      <div className="text-center">
        <div className="text-6xl font-mono font-light tracking-tight text-gray-900">
          {formatDuration(elapsed)}
        </div>
        {active && (
          <p className="text-sm text-gray-500 mt-2">Timer running…</p>
        )}
      </div>

      {!active ? (
        /* Setup form */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => { setSelectedProject(e.target.value); setSelectedTask(""); }}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Task</label>
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              disabled={!selectedProject}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Select a task…</option>
              {availableTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleStart}
            disabled={loading || !selectedTask}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Starting…" : "Start timer"}
          </button>
        </div>
      ) : (
        /* Running state */
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
            <p>Started at {new Date(active.startedAt).toLocaleTimeString()}</p>
            {active.description && <p className="mt-0.5 text-gray-500">{active.description}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleStop}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Stopping…" : "Stop timer"}
          </button>
        </div>
      )}
    </div>
  );
}
