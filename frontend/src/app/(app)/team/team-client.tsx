"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  members: Member[];
  currentUserId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

export default function TeamClient({ members: initial, currentUserId }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchWithToken(path: string, options: RequestInit = {}) {
    const session = await fetch("/api/auth/session").then((r) => r.json());
    const token = session?.accessToken;
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    setError("");
    setInviteLink("");

    const res = await fetchWithToken("/api/invites", {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail }),
    });

    setInviteLoading(false);

    if (!res.ok) {
      setError("Failed to create invite.");
      return;
    }

    const data = await res.json();
    setInviteLink(data.inviteUrl);
    setInviteEmail("");
  }

  async function handleRoleChange(memberId: string, role: string) {
    const res = await fetchWithToken(`/api/team/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member from the team?")) return;
    const res = await fetchWithToken(`/api/team/members/${memberId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      {/* Invite form */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-medium mb-4">Invite a team member</h2>
        <form onSubmit={handleInvite} className="flex gap-3">
          <input
            type="email"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="submit"
            disabled={inviteLoading}
            className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {inviteLoading ? "Generating…" : "Generate invite link"}
          </button>
        </form>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {inviteLink && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-1">Share this link with your team member:</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 border rounded-md px-3 py-2 text-sm bg-gray-50 font-mono"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="text-sm px-3 py-2 border rounded-md hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Member list */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Role</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-6 py-4 font-medium">{m.name}</td>
                <td className="px-6 py-4 text-gray-600">{m.email}</td>
                <td className="px-6 py-4">
                  {m.id === currentUserId ? (
                    <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">{m.role}</span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {m.id !== currentUserId && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
