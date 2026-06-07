"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

interface Props {
  userName: string;
  isAdmin: boolean;
}

export default function Sidebar({ userName, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/timer", label: "Timer" },
    { href: "/entries", label: "Time Entries" },
    { href: "/projects", label: "Projects" },
    ...(isAdmin ? [{ href: "/team", label: "Team" }] : []),
    { href: "/reports", label: "Reports" },
  ];

  function linkCls(href: string) {
    const active =
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(href));
    return `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
      active ? "bg-blue-900 text-white" : "hover:bg-blue-900 hover:text-white"
    }`;
  }

  const inner = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-blue-900 flex items-center gap-3">
        <Image
          src="/cobalt-logo.png"
          alt="Cobalt"
          width={36}
          height={36}
          className="rounded-full shrink-0"
        />
        <div>
          <span className="font-bold text-white tracking-wide text-base">Cobalt</span>
          <p className="text-blue-400 text-xs font-medium">Time Tracker</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={linkCls(l.href)}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-blue-900 space-y-0.5">
        <div className="px-3 py-1 text-blue-400 truncate text-xs">{userName}</div>
        <Link
          href="/settings"
          className={linkCls("/settings")}
          onClick={() => setOpen(false)}
        >
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-3 py-2 rounded-md hover:bg-blue-900 hover:text-white transition-colors text-blue-300 text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-blue-950 text-white flex items-center px-4 border-b border-blue-900">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-md hover:bg-blue-900 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="flex items-center gap-2 ml-3">
          <img src="/cobalt-logo.png" alt="Cobalt" width={28} height={28} className="rounded-full" />
          <span className="font-bold tracking-wide text-sm">Cobalt</span>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile slide-in drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-blue-950 text-blue-100 transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {inner}
      </div>

      {/* Desktop permanent sidebar */}
      <aside className="hidden lg:flex w-56 bg-blue-950 text-blue-100 flex-col shrink-0">
        {inner}
      </aside>
    </>
  );
}
