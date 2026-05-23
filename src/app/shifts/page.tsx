"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface Shift {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  opened_at: string;
  closed_at: string | null;
  starting_cash_sar: number;
  expected_cash_sar: number;
  actual_cash_sar: number;
  discrepancy_sar: number;
  status: "open" | "closed";
  notes: string | null;
}

interface UserInfo {
  id: string;
  role: "admin" | "cashier";
}

export default function ShiftsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startingCash, setStartingCash] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [closedResult, setClosedResult] = useState<{
    starting_cash_sar: number;
    total_sales_sar: number;
    expected_cash_sar: number;
    actual_cash_sar: number;
    discrepancy_sar: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (cancelled || !authUser) return;

      supabase
        .from("user_profiles")
        .select("role")
        .eq("id", authUser.id)
        .single()
        .then(({ data: profile }) => {
          if (cancelled) return;
          const role = (profile?.role as "admin" | "cashier") || "cashier";
          setUser({ id: authUser.id, role });

          if (role === "admin") {
            fetch("/api/shifts?all=true")
              .then((r) => r.json())
              .then((d) => { if (!cancelled && d.shifts) setShifts(d.shifts); })
              .finally(() => { if (!cancelled) setIsLoading(false); });
          } else {
            fetch(`/api/shifts?user_id=${authUser.id}`)
              .then((r) => r.json())
              .then((d) => {
                if (cancelled) return;
                if (d.shifts) {
                  setShifts(d.shifts);
                  const open = d.shifts.find((s: Shift) => s.status === "open");
                  if (open) setOpenShift(open);
                }
              })
              .finally(() => { if (!cancelled) setIsLoading(false); });
          }
        });
    });

    return () => { cancelled = true; };
  }, []);

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          starting_cash_sar: parseFloat(startingCash) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Shift opened with ${data.shift.starting_cash_sar.toFixed(2)} SAR starting cash` });
        setOpenShift(data.shift);
        setStartingCash("");
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault();
    if (!openShift) return;
    setIsSubmitting(true);
    setMessage(null);
    setClosedResult(null);

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: openShift.id,
          actual_cash_sar: parseFloat(actualCash) || 0,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClosedResult(data.shift);
        setMessage({ type: "success", text: "Shift closed successfully" });
        setOpenShift(null);
        setActualCash("");
        setNotes("");
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-400">Loading shift data...</p>
      </div>
    );
  }

  // ADMIN VIEW — Z-Report
  if (user?.role === "admin") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Z-Report — Shift History
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              مخابز ايمان — &ldquo;The Taste of Tradition&rdquo;
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                All Shifts ({shifts.length})
              </h2>
            </div>

            {shifts.length === 0 ? (
              <div className="p-8 text-center text-zinc-400">No shifts recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Cashier</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Opened</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Closed</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Start Cash</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Expected</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actual</th>
                      <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Discrepancy</th>
                      <th className="text-center px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">
                            {shift.full_name || shift.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {new Date(shift.opened_at).toLocaleString("en-SA", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {shift.closed_at
                            ? new Date(shift.closed_at).toLocaleString("en-SA", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {shift.starting_cash_sar.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {shift.status === "closed" ? shift.expected_cash_sar.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {shift.status === "closed" ? shift.actual_cash_sar.toFixed(2) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${
                          shift.status !== "closed"
                            ? "text-zinc-400"
                            : shift.discrepancy_sar < 0
                              ? "text-red-600 dark:text-red-400"
                              : shift.discrepancy_sar > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-zinc-600 dark:text-zinc-400"
                        }`}>
                          {shift.status === "closed"
                            ? `${shift.discrepancy_sar >= 0 ? "+" : ""}${shift.discrepancy_sar.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            shift.status === "open"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}>
                            {shift.status}
                          </span>
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

  // CASHIER VIEW — Open/Close Shift
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Shift Management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            مخابز ايمان — &ldquo;The Taste of Tradition&rdquo;
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}>
            {message.type === "success" ? "✓" : "✗"} {message.text}
          </div>
        )}

        {/* Close Result Summary */}
        {closedResult && (
          <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-3">
              Shift Summary (Z-Report)
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Starting Cash:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{closedResult.starting_cash_sar.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">+ Cash Sales:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{closedResult.total_sales_sar.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2">
                <span className="text-zinc-500 font-semibold">= Expected Cash:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-bold">{closedResult.expected_cash_sar.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Actual Counted:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{closedResult.actual_cash_sar.toFixed(2)} SAR</span>
              </div>
              <div className={`flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 font-bold ${
                closedResult.discrepancy_sar < 0
                  ? "text-red-600 dark:text-red-400"
                  : closedResult.discrepancy_sar > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-zinc-800 dark:text-zinc-200"
              }`}>
                <span>Discrepancy:</span>
                <span>{closedResult.discrepancy_sar >= 0 ? "+" : ""}{closedResult.discrepancy_sar.toFixed(2)} SAR</span>
              </div>
            </div>
          </div>
        )}

        {/* No Open Shift → Open Shift Form */}
        {!openShift && (
          <form
            onSubmit={handleOpenShift}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              Open New Shift
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Count the cash in your drawer and enter the amount below.
            </p>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Starting Cash (SAR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                required
                placeholder="e.g., 500.00"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-lg font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 text-white font-semibold py-3 transition-colors"
            >
              {isSubmitting ? "Opening..." : "Open Shift"}
            </button>
          </form>
        )}

        {/* Open Shift → Close Shift Form */}
        {openShift && (
          <form
            onSubmit={handleCloseShift}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                Close Current Shift
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium">
                Active
              </span>
            </div>

            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Opened at:</span>
                <span>{new Date(openShift.opened_at).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400 mt-1">
                <span>Starting Cash:</span>
                <span className="font-mono font-medium">{openShift.starting_cash_sar.toFixed(2)} SAR</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Actual Cash Counted (SAR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                required
                placeholder="Count all cash in the drawer"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-lg font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Gave 20 SAR change from personal wallet"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 text-white font-semibold py-3 transition-colors"
            >
              {isSubmitting ? "Closing..." : "Close Shift & Generate Z-Report"}
            </button>
          </form>
        )}

        {/* Shift History */}
        {shifts.filter((s) => s.status === "closed").length > 0 && (
          <div className="mt-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                My Past Shifts
              </h3>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shifts.filter((s) => s.status === "closed").map((shift) => (
                <div key={shift.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(shift.opened_at).toLocaleDateString("en-SA", { dateStyle: "medium" })}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {new Date(shift.opened_at).toLocaleTimeString("en-SA", { timeStyle: "short" })} — {new Date(shift.closed_at!).toLocaleTimeString("en-SA", { timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`text-xs font-mono font-bold ${
                    shift.discrepancy_sar < 0
                      ? "text-red-600 dark:text-red-400"
                      : shift.discrepancy_sar > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-600 dark:text-zinc-400"
                  }`}>
                    {shift.discrepancy_sar >= 0 ? "+" : ""}{shift.discrepancy_sar.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
