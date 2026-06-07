import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import DashboardClient, { TimeEntry } from "./dashboard-client";

interface Project { id: string; name: string }

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [projects, entries, activeEntry] = await Promise.all([
    api.get<Project[]>("/api/projects"),
    api.get<TimeEntry[]>("/api/time-entries"),
    api.get<TimeEntry | null>("/api/time-entries/active"),
  ]);

  return (
    <DashboardClient
      projects={projects}
      initialEntries={entries}
      initialActive={activeEntry}
      accessToken={session.accessToken ?? ""}
    />
  );
}
