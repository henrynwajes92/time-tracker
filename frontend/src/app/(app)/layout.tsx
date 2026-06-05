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
      <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-700">
          <span className="font-semibold text-white">Time Tracker</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
            Dashboard
          </Link>
          <Link href="/timer" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
            Timer
          </Link>
          <Link href="/entries" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
            Time Entries
          </Link>
          <Link href="/projects" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
            Projects
          </Link>
          {isAdmin && (
            <Link href="/team" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
              Team
            </Link>
          )}
          <Link href="/reports" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
            Reports
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-gray-700 text-sm space-y-1">
          <div className="px-3 py-1 text-gray-400 truncate">{session.user.name}</div>
          <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800">
            Settings
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}
