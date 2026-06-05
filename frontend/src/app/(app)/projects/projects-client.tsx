"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Project } from "./page";

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
  projects: Project[];
  isAdmin: boolean;
}

export default function ProjectsClient({ projects: initial, isAdmin }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    const res = await fetchWithToken("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });

    setCreating(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create project.");
      return;
    }

    const project: Project = await res.json();
    setProjects((prev) => [...prev, project]);
    setName("");
    setDescription("");
    setShowForm(false);
    router.refresh();
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this project? It will no longer appear in time entry forms.")) return;
    const res = await fetchWithToken(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
            >
              New project
            </button>
          ) : (
            <div className="w-full bg-white rounded-xl border shadow-sm p-5">
              <h2 className="font-medium mb-4">New project</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <input
                  placeholder="Project name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating} className="bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                    {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {isAdmin ? "No projects yet. Create your first project above." : "No projects have been created yet."}
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between">
              <div>
                <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                {p.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/projects/${p.id}`} className="text-sm text-gray-600 hover:underline">
                  View tasks
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => handleArchive(p.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
