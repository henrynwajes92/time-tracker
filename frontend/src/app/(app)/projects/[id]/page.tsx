import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import ProjectDetailClient from "./project-detail-client";

interface Task {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  teamId: string;
  createdAt: string;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const data = await api.get<{ project: Project; tasks: Task[] }>(`/api/projects/${id}`);
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <ProjectDetailClient project={data.project} tasks={data.tasks} isAdmin={isAdmin} accessToken={session.accessToken ?? ""} />
      </div>
    </div>
  );
}
