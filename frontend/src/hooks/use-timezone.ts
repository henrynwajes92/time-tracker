"use client";

import { useEffect, useState } from "react";

const TZ_KEY = "cobalt_timezone";

export function useTimezone() {
  const [timezone, setTimezone] = useState<string>("UTC");

  useEffect(() => {
    const stored = localStorage.getItem(TZ_KEY);
    setTimezone(stored ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  function saveTimezone(tz: string) {
    localStorage.setItem(TZ_KEY, tz);
    setTimezone(tz);
  }

  return { timezone, saveTimezone };
}

export function getStoredTimezone(): string {
  if (typeof window === "undefined") return "UTC";
  return localStorage.getItem(TZ_KEY) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
