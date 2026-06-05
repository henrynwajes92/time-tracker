import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import ProjectsClient from "./projects-client";

export interface Project {
  id: string;
  name: string;
  description: string;
  teamId: string;
  createdAt: string;
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const projects = await api.get<Project[]>("/api/projects");
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Projects</h1>
        <ProjectsClient projects={projects} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
