"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  return (
    <div className="p-8">
      <div className="max-w-lg mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Profile */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="font-medium">Profile</h2>
          <form onSubmit={handleProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                value={session?.user?.email ?? ""}
                disabled
                className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500"
              />
            </div>
            {profileMsg && (
              <p className="text-sm text-gray-600">{profileMsg}</p>
            )}
            <button
              type="submit"
              disabled={profileLoading}
              className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {profileLoading ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="font-medium">Change password</h2>
          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            {passwordMsg && (
              <p className="text-sm text-gray-600">{passwordMsg}</p>
            )}
            <button
              type="submit"
              disabled={passwordLoading}
              className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {passwordLoading ? "Changing…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
