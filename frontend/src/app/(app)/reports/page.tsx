import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import ReportsClient from "./reports-client";

interface Member { id: string; name: string }
interface Project { id: string; name: string }

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const [members, projects] = await Promise.all([
    isAdmin ? api.get<Member[]>("/api/team/members") : Promise.resolve([]),
    api.get<Project[]>("/api/projects"),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Reports</h1>
        <ReportsClient
          members={members}
          projects={projects}
          isAdmin={isAdmin}
          currentUserId={session.user.id}
          accessToken={session.accessToken ?? ""}
        />
      </div>
    </div>
  );
}
