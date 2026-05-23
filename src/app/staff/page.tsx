"use client";

import { useState, useEffect } from "react";

interface StaffUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "cashier";
  is_active: boolean;
  created_at: string;
}

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "cashier">("cashier");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/staff")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.users) setUsers(data.users);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load staff");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function refreshUsers() {
    fetch("/api/staff")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Account created for "${data.user.full_name}" (${data.user.email}) as ${data.user.role}`);
        setFullName("");
        setEmail("");
        setPassword("");
        setRole("cashier");
        setShowForm(false);
        refreshUsers();
      } else {
        setError(data.error || "Failed to create account");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Staff Management
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              مخابز ايمان — &ldquo;The Taste of Tradition&rdquo;
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setError(null);
              setSuccess(null);
            }}
            className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors"
          >
            {showForm ? "Cancel" : "+ Add Staff"}
          </button>
        </div>

        {/* Messages */}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300">
            ✗ {error}
          </div>
        )}

        {/* Create Staff Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
              Create New Staff Account
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g., Ahmad Al-Rashidi"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="e.g., cashier1@emanbakery.sa"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Password * (min 6 characters)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "cashier")}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="cashier">Cashier (POS + Expenses only)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold text-sm transition-colors"
              >
                {isSubmitting ? "Creating..." : "Create Account"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Staff Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
              Staff Directory ({users.length} users)
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
              Loading staff...
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
              No staff accounts found. Click &ldquo;+ Add Staff&rdquo; to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Email
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Role
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            user.is_active
                              ? "bg-green-500"
                              : "bg-zinc-300 dark:bg-zinc-600"
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString("en-SA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
