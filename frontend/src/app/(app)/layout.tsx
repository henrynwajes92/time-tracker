import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <Sidebar userName={session.user.name ?? ""} isAdmin={session.user.role === "ADMIN"} />
      <main className="flex-1 bg-slate-50 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
