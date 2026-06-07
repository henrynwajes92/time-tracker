import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import TimerWidget from "./timer-widget";

interface Project { id: string; name: string }
interface TimeEntry {
  id: string; projectId?: string; projectName: string;
  startedAt: string; endedAt?: string; durationSeconds?: number; description: string;
}

export default async function TimerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [projects, activeEntry] = await Promise.all([
    api.get<Project[]>("/api/projects"),
    api.get<TimeEntry | null>("/api/time-entries/active"),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6 sm:mb-8">Timer</h1>
        <TimerWidget projects={projects} initialActive={activeEntry} accessToken={session.accessToken ?? ""} />
      </div>
    </div>
  );
}
