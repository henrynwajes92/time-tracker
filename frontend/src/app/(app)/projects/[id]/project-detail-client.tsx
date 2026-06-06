"use client";

import { useState } from "react";
import Link from "next/link";

interface Task { id: string; name: string; projectId: string }
interface Project { id: string; name: string; description: string }

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

interface Props {
  project: Project;
  tasks: Task[];
  isAdmin: boolean;
}

export default function ProjectDetailClient({ project, tasks: initialTasks, isAdmin }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [newTaskName, setNewTaskName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");

    const res = await fetchWithToken(`/api/projects/${project.id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ name: newTaskName }),
    });

    setAdding(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create task.");
      return;
    }

    const task: Task = await res.json();
    setTasks((prev) => [...prev, task]);
    setNewTaskName("");
  }

  async function handleUpdateTask(id: string) {
    const res = await fetchWithToken(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name: editName } : t)));
      setEditingId(null);
    }
  }

  async function handleArchiveTask(id: string) {
    if (!confirm("Archive this task?")) return;
    const res = await fetchWithToken(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-gray-500 hover:underline">← Projects</Link>
        <h1 className="text-2xl font-semibold mt-1">{project.name}</h1>
        {project.description && <p className="text-gray-500 mt-1">{project.description}</p>}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-medium">Tasks</h2>
          <span className="text-sm text-gray-500">{tasks.length} tasks</span>
        </div>

        {tasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            {isAdmin ? "No tasks yet. Add one below." : "No tasks yet."}
          </div>
        ) : (
          <ul className="divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="px-6 py-3 flex items-center gap-3">
                {editingId === t.id ? (
                  <>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => handleUpdateTask(t.id)} className="text-sm font-medium hover:underline">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{t.name}</span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                          className="text-sm text-gray-500 hover:underline"
                        >
                          Edit
                        </button>
                        <button onClick={() => handleArchiveTask(t.id)} className="text-sm text-red-600 hover:underline">
                          Archive
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {isAdmin && (
          <form onSubmit={handleAddTask} className="px-6 py-4 border-t flex gap-2">
            <input
              placeholder="New task name"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              required
              className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add task"}
            </button>
          </form>
        )}
        {error && <p className="px-6 pb-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
