"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TimeEntry {
  id: string; startedAt: string; description: string;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function ActiveTimerBanner({ entry }: { entry: TimeEntry }) {
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-blue-700 text-white rounded-xl px-6 py-4 flex items-center justify-between max-w-2xl">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">Timer running</p>
        <p className="font-mono text-2xl mt-0.5">{formatElapsed(elapsed)}</p>
        {entry.description && <p className="text-sm text-gray-300 mt-0.5">{entry.description}</p>}
      </div>
      <Link
        href="/timer"
        className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
      >
        Stop timer
      </Link>
    </div>
  );
}
