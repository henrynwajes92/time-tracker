"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useTimezone } from "@/hooks/use-timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

const ALL_TIMEZONES: string[] = typeof Intl !== "undefined" && "supportedValuesOf" in Intl
  ? (Intl as any).supportedValuesOf("timeZone")
  : ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
     "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
     "Australia/Sydney", "Pacific/Auckland"];

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const { timezone, saveTimezone } = useTimezone();
  const [tzMsg, setTzMsg] = useState("");

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  async function fetchWithToken(path: string, options: RequestInit = {}) {
    const token = (session as any)?.accessToken;
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg("");
    const res = await fetchWithToken("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setProfileLoading(false);
    if (res.ok) {
      await update({ name });
      setProfileMsg("Profile updated.");
    } else {
      const data = await res.json();
      setProfileMsg(data.error ?? "Update failed.");
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMsg("");
    const res = await fetchWithToken("/api/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setPasswordLoading(false);
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg("Password changed.");
    } else {
      const data = await res.json();
      setPasswordMsg(data.error ?? "Password change failed.");
    }
  }

  function handleSaveTimezone(e: React.FormEvent) {
    e.preventDefault();
    setTzMsg("Timezone saved.");
    setTimeout(() => setTzMsg(""), 2500);
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-lg mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Profile */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="font-medium">Profile</h2>
          <form onSubmit={handleProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={session?.user?.email ?? ""}
                disabled
                className="h-9"
              />
            </div>
            {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
            <Button type="submit" disabled={profileLoading} size="sm">
              {profileLoading ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </div>

        {/* Timezone */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div>
            <h2 className="font-medium">Timezone</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dates and times will be shown in this timezone.
            </p>
          </div>
          <form onSubmit={handleSaveTimezone} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <NativeSelect
                id="timezone"
                value={timezone}
                onChange={(e) => saveTimezone(e.target.value)}
                className="h-9"
              >
                {ALL_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </NativeSelect>
            </div>
            {tzMsg && <p className="text-sm text-muted-foreground">{tzMsg}</p>}
            <Button type="submit" size="sm">
              Save timezone
            </Button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="font-medium">Change password</h2>
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="h-9"
              />
            </div>
            {passwordMsg && <p className="text-sm text-muted-foreground">{passwordMsg}</p>}
            <Button type="submit" disabled={passwordLoading} size="sm">
              {passwordLoading ? "Changing…" : "Change password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
