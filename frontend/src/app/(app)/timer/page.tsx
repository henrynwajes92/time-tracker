import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import TimerWidget from "./timer-widget";

interface Task { id: string; name: string; projectId: string }
interface Project { id: string; name: string; tasks?: Task[] }
interface TimeEntry {
  id: string; taskId: string; startedAt: string;
  endedAt?: string; durationSeconds?: number; description: string;
}

export default async function TimerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [projects, activeEntry] = await Promise.all([
    api.get<Project[]>("/api/projects"),
    api.get<TimeEntry | null>("/api/time-entries/active"),
  ]);

  // Fetch tasks for each project
  const projectsWithTasks = await Promise.all(
    projects.map(async (p) => {
      const data = await api.get<{ project: Project; tasks: Task[] }>(`/api/projects/${p.id}`);
      return { ...p, tasks: data.tasks };
    })
  );

  return (
    <div className="p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold mb-8">Timer</h1>
        <TimerWidget projects={projectsWithTasks} initialActive={activeEntry} accessToken={session.accessToken ?? ""} />
      </div>
    </div>
  );
}
