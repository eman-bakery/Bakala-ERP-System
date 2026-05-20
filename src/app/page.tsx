"use client";

import { useState, useEffect } from "react";

interface Metric {
  halalas: number;
  sar: number;
  label: string;
  label_ar: string;
  is_positive?: boolean;
  output_vat_sar?: number;
  input_vat_sar?: number;
}

interface LowStockItem {
  id: string;
  sku: string;
  item_name: string;
  item_name_ar: string | null;
  category: string | null;
  stock_quantity: number;
  reorder_level: number;
  retail_price_sar: number;
}

interface RecentTransaction {
  number: number;
  type: string;
  total_sar: number;
  status: string;
  date: string;
}

interface DashboardData {
  metrics: {
    total_revenue: Metric;
    total_expenses: Metric;
    net_profit: Metric;
    vat_liability: Metric;
  };
  low_stock_alerts: LowStockItem[];
  summary: {
    total_transactions: number;
    recent_transactions: RecentTransaction[];
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          if (json.error) {
            setError(json.error);
          } else {
            setData(json);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Loading dashboard...</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 italic">
            &ldquo;The Taste of Tradition&rdquo;
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-lg text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, low_stock_alerts, summary } = data;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Executive Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            مخابز ايمان — &ldquo;The Taste of Tradition&rdquo; (SINCE 2007)
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Revenue */}
          <MetricCard
            icon="📈"
            label={metrics.total_revenue.label}
            labelAr={metrics.total_revenue.label_ar}
            value={metrics.total_revenue.sar}
            color="green"
          />

          {/* Expenses */}
          <MetricCard
            icon="📉"
            label={metrics.total_expenses.label}
            labelAr={metrics.total_expenses.label_ar}
            value={metrics.total_expenses.sar}
            color="red"
          />

          {/* Net Profit */}
          <MetricCard
            icon="💰"
            label={metrics.net_profit.label}
            labelAr={metrics.net_profit.label_ar}
            value={metrics.net_profit.sar}
            color={metrics.net_profit.is_positive ? "green" : "red"}
            highlight
          />

          {/* VAT Liability */}
          <MetricCard
            icon="🏛️"
            label={metrics.vat_liability.label}
            labelAr={metrics.vat_liability.label_ar}
            value={metrics.vat_liability.sar}
            color="amber"
            subtitle={`Output: ${metrics.vat_liability.output_vat_sar?.toFixed(2)} − Input: ${metrics.vat_liability.input_vat_sar?.toFixed(2)}`}
          />
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alerts */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                ⚠️ Low Stock Alerts
              </h2>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                &lt; 15 units
              </span>
            </div>

            {low_stock_alerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-green-600 dark:text-green-400">
                ✓ All items are well-stocked
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {low_stock_alerts.map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {item.item_name}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {item.sku} • {item.category || "Uncategorized"}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">
                        {item.stock_quantity} units
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        reorder at {item.reorder_level}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                Recent Transactions
              </h2>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {summary.total_transactions} total
              </span>
            </div>

            {summary.recent_transactions.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                No transactions yet
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {summary.recent_transactions.map((txn) => (
                  <div
                    key={txn.number}
                    className="px-6 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Sale #{txn.number}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {new Date(txn.date).toLocaleDateString("en-SA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-zinc-800 dark:text-zinc-200">
                        {txn.total_sar.toFixed(2)} SAR
                      </p>
                      <p className="text-[10px] text-green-600 dark:text-green-400 uppercase font-medium">
                        {txn.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Bakala ERP System • شركة مخابز ايمان جدة للخبز • ZATCA Phase 2 Ready
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  labelAr,
  value,
  color,
  subtitle,
  highlight,
}: {
  icon: string;
  label: string;
  labelAr: string;
  value: number;
  color: "green" | "red" | "amber";
  subtitle?: string;
  highlight?: boolean;
}) {
  const colorMap = {
    green: {
      border: "border-green-200 dark:border-green-800",
      bg: highlight ? "bg-green-50 dark:bg-green-950/30" : "bg-white dark:bg-zinc-900",
      text: "text-green-700 dark:text-green-400",
    },
    red: {
      border: "border-red-200 dark:border-red-800",
      bg: highlight ? "bg-red-50 dark:bg-red-950/30" : "bg-white dark:bg-zinc-900",
      text: "text-red-700 dark:text-red-400",
    },
    amber: {
      border: "border-amber-200 dark:border-amber-800",
      bg: highlight ? "bg-amber-50 dark:bg-amber-950/30" : "bg-white dark:bg-zinc-900",
      text: "text-amber-700 dark:text-amber-400",
    },
  };

  const c = colorMap[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} shadow-sm p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium ${c.text} uppercase tracking-wide`}>
          {color === "green" && value > 0 ? "↑" : color === "red" && value > 0 ? "↓" : ""}
        </span>
      </div>
      <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
        {value.toFixed(2)}{" "}
        <span className="text-sm font-normal text-zinc-400">SAR</span>
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{label}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500" dir="rtl">
        {labelAr}
      </p>
      {subtitle && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
          {subtitle}
        </p>
      )}
    </div>
  );
}
