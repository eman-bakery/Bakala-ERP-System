"use client";

import { useState, useEffect } from "react";

interface Supplier {
  id: string;
  name: string;
  name_ar: string | null;
}

interface Delivery {
  id: string;
  supplier_name: string;
  supplier_name_ar: string | null;
  total_cost_sar: number;
  payment_status: "paid" | "unpaid";
  delivery_date: string;
  notes: string | null;
  created_at: string;
}

interface InventoryItem {
  id: string;
  item_name: string;
  item_name_ar: string | null;
  sku: string;
  stock_quantity: number;
}

interface DeliveryLine {
  inventory_item_id: string;
  quantity: string;
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [apTotal, setApTotal] = useState(0);
  const [apCount, setApCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("unpaid");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<DeliveryLine[]>([{ inventory_item_id: "", quantity: "" }]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/deliveries").then((r) => r.json()),
      fetch("/api/inventory").then((r) => r.json()),
    ]).then(([delData, invData]) => {
      if (cancelled) return;
      if (delData.deliveries) setDeliveries(delData.deliveries);
      if (delData.suppliers) setSuppliers(delData.suppliers);
      if (delData.accounts_payable) {
        setApTotal(delData.accounts_payable.total_unpaid_sar);
        setApCount(delData.accounts_payable.unpaid_count);
      }
      if (invData.items) setInventoryItems(invData.items);
    }).finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  function addLine() {
    setLines([...lines, { inventory_item_id: "", quantity: "" }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof DeliveryLine, value: string) {
    setLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function refreshData() {
    fetch("/api/deliveries").then((r) => r.json()).then((data) => {
      if (data.deliveries) setDeliveries(data.deliveries);
      if (data.accounts_payable) {
        setApTotal(data.accounts_payable.total_unpaid_sar);
        setApCount(data.accounts_payable.unpaid_count);
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const validLines = lines.filter((l) => l.inventory_item_id && parseInt(l.quantity) > 0);
    if (validLines.length === 0) {
      setMessage({ type: "error", text: "Add at least one item with quantity" });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          total_cost_sar: parseFloat(totalCost),
          payment_status: paymentStatus,
          delivery_date: deliveryDate,
          notes: notes || undefined,
          items: validLines.map((l) => ({
            inventory_item_id: l.inventory_item_id,
            quantity: parseInt(l.quantity),
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Delivery logged: ${data.delivery.items_count} items, ${data.delivery.total_units} units received. Stock updated.`,
        });
        setSupplierId("");
        setTotalCost("");
        setPaymentStatus("unpaid");
        setLines([{ inventory_item_id: "", quantity: "" }]);
        setNotes("");
        setShowForm(false);
        refreshData();
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
        <p className="text-zinc-400">Loading deliveries...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Supplier Deliveries
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              مخابز ايمان — &ldquo;The Taste of Tradition&rdquo;
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setMessage(null); }}
            className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors"
          >
            {showForm ? "Cancel" : "+ Log Delivery"}
          </button>
        </div>

        {/* Accounts Payable Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-800 p-5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Accounts Payable (Unpaid)
            </p>
            <p className="text-2xl font-bold font-mono text-red-700 dark:text-red-400 mt-1">
              {apTotal.toFixed(2)} <span className="text-sm font-normal text-zinc-400">SAR</span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">{apCount} unpaid invoices</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Total Deliveries
            </p>
            <p className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-200 mt-1">
              {deliveries.length}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{suppliers.length} suppliers registered</p>
          </div>
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

        {/* Log Delivery Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
              Log New Delivery
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Supplier *</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.name_ar ? ` (${s.name_ar})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Total Invoice Cost (SAR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as "paid" | "unpaid")}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Delivery Items */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Items Received *
                </label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={line.inventory_item_id}
                      onChange={(e) => updateLine(i, "inventory_item_id", e.target.value)}
                      required
                      className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">— Select Product —</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item_name} ({item.sku}) — Stock: {item.stock_quantity}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      required
                      placeholder="Qty"
                      className="w-24 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-sm hover:bg-red-200"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Invoice #12345"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 text-white font-semibold text-sm transition-colors"
              >
                {isSubmitting ? "Saving..." : "Log Delivery & Update Stock"}
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

        {/* Deliveries Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
              Delivery History ({deliveries.length})
            </h2>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No deliveries recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Date</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Cost (SAR)</th>
                    <th className="text-center px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Payment</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{d.supplier_name}</p>
                        {d.supplier_name_ar && (
                          <p className="text-[10px] text-zinc-400" dir="rtl">{d.supplier_name_ar}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                        {new Date(d.delivery_date).toLocaleDateString("en-SA", { dateStyle: "medium" })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {d.total_cost_sar.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          d.payment_status === "paid"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                        }`}>
                          {d.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                        {d.notes || "—"}
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
