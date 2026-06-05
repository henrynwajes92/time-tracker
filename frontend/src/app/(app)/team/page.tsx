import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import TeamClient from "./team-client";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string;
  createdAt: string;
}

export default async function TeamPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const members = await api.get<Member[]>("/api/team/members");

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Team</h1>
        <TeamClient members={members} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
