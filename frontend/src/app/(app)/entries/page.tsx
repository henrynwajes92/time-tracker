import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import EntriesClient, { TimeEntry } from "./entries-client";

interface Project { id: string; name: string }

export default async function EntriesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [entries, projects] = await Promise.all([
    api.get<TimeEntry[]>("/api/time-entries"),
    api.get<Project[]>("/api/projects"),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Time Entries</h1>
        <EntriesClient entries={entries} projects={projects} accessToken={session.accessToken ?? ""} />
      </div>
    </div>
  );
}
