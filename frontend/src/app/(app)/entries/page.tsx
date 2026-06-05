import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import EntriesClient from "./entries-client";

export interface TimeEntry {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  description: string;
}

interface Task { id: string; name: string; projectId: string }
interface Project { id: string; name: string; tasks: Task[] }

export default async function EntriesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [entries, projects] = await Promise.all([
    api.get<TimeEntry[]>("/api/time-entries"),
    api.get<Project[]>("/api/projects"),
  ]);

  const projectsWithTasks = await Promise.all(
    projects.map(async (p) => {
      const data = await api.get<{ project: Project; tasks: Task[] }>(`/api/projects/${p.id}`);
      return { ...p, tasks: data.tasks };
    })
  );

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Time Entries</h1>
        <EntriesClient entries={entries} projects={projectsWithTasks} />
      </div>
    </div>
  );
}
