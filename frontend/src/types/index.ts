export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  teamId: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  archivedAt?: string;
  createdAt: string;
  tasks?: Task[];
}

export interface Task {
  id: string;
  name: string;
  projectId: string;
  archivedAt?: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  taskId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  description?: string;
  createdAt: string;
  task?: Task & { project: Project };
}

export interface Report {
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  totalSeconds: number;
  totalHours: number;
}
