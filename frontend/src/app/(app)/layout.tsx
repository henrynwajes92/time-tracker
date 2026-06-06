import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-blue-950 text-blue-100 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-blue-900">
          <span className="font-bold text-white tracking-wide text-lg">Cobalt</span>
          <p className="text-blue-400 text-xs mt-0.5 font-medium">Time Tracker</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 text-sm">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/timer" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
            Timer
          </Link>
          <Link href="/entries" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
            Time Entries
          </Link>
          <Link href="/projects" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
            Projects
          </Link>
          {isAdmin && (
            <Link href="/team" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
              Team
            </Link>
          )}
          <Link href="/reports" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
            Reports
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-blue-900 text-sm space-y-0.5">
          <div className="px-3 py-1 text-blue-400 truncate text-xs">{session.user.name}</div>
          <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors">
            Settings
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="w-full text-left px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors text-blue-300">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}
