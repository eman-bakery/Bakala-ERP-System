"use client";

import { useState, useEffect } from "react";

interface InventoryItem {
  id: string;
  sku: string;
  barcode: string | null;
  item_name: string;
  item_name_ar: string | null;
  category: string | null;
  unit_of_measure: string;
  wholesale_price: number;
  retail_price: number;
  wholesale_price_sar: number;
  retail_price_sar: number;
  vat_category: "standard" | "zero_rated";
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
}

interface FormData {
  item_name: string;
  item_name_ar: string;
  sku: string;
  barcode: string;
  category: string;
  wholesale_price_sar: string;
  retail_price_sar: string;
  vat_category: "standard" | "zero_rated";
  stock_quantity: string;
  reorder_level: string;
}

const EMPTY_FORM: FormData = {
  item_name: "",
  item_name_ar: "",
  sku: "",
  barcode: "",
  category: "",
  wholesale_price_sar: "",
  retail_price_sar: "",
  vat_category: "standard",
  stock_quantity: "0",
  reorder_level: "0",
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inventory")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.items) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load inventory");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function refreshItems() {
    fetch("/api/inventory")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setItems(data.items);
      });
  }

  function updateForm(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: form.item_name,
          item_name_ar: form.item_name_ar || undefined,
          sku: form.sku,
          barcode: form.barcode || undefined,
          category: form.category || undefined,
          wholesale_price_sar: parseFloat(form.wholesale_price_sar),
          retail_price_sar: parseFloat(form.retail_price_sar),
          vat_category: form.vat_category,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          reorder_level: parseInt(form.reorder_level) || 0,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`"${data.item.item_name}" added successfully (SKU: ${data.item.sku})`);
        setForm(EMPTY_FORM);
        setShowForm(false);
        refreshItems();
      } else {
        setError(data.error || "Failed to add item");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const retailGross = parseFloat(form.retail_price_sar);
  const vatPreview =
    !isNaN(retailGross) && retailGross > 0
      ? {
          gross: retailGross,
          net: Math.round((retailGross * 100) / 1.15) / 100,
          vat: retailGross - Math.round((retailGross * 100) / 1.15) / 100,
        }
      : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Inventory Management
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
            {showForm ? "Cancel" : "+ Add Product"}
          </button>
        </div>

        {/* Success / Error Messages */}
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

        {/* Add Product Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
              Add New Product
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Item Name EN */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Item Name (English) *
                </label>
                <input
                  type="text"
                  value={form.item_name}
                  onChange={(e) => updateForm("item_name", e.target.value)}
                  required
                  placeholder="e.g., Almarai Long Life Milk 1L"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Item Name AR */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Item Name (Arabic)
                </label>
                <input
                  type="text"
                  value={form.item_name_ar}
                  onChange={(e) => updateForm("item_name_ar", e.target.value)}
                  placeholder="e.g., حليب المراعي طويل الأجل"
                  dir="rtl"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => updateForm("sku", e.target.value)}
                  required
                  placeholder="e.g., MLK-ALM-001"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Barcode
                </label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => updateForm("barcode", e.target.value)}
                  placeholder="e.g., 6281007028424"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">— Select —</option>
                  <option value="Dairy">Dairy (ألبان)</option>
                  <option value="Beverages">Beverages (مشروبات)</option>
                  <option value="Snacks">Snacks (وجبات خفيفة)</option>
                  <option value="Bread & Bakery">Bread & Bakery (مخبوزات)</option>
                  <option value="Household">Household (منزلية)</option>
                  <option value="Personal Care">Personal Care (عناية شخصية)</option>
                  <option value="Canned & Dry">Canned & Dry (معلبات)</option>
                  <option value="Frozen">Frozen (مجمدات)</option>
                </select>
              </div>

              {/* VAT Category */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  VAT Category
                </label>
                <select
                  value={form.vat_category}
                  onChange={(e) => updateForm("vat_category", e.target.value as "standard" | "zero_rated")}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="standard">Standard (15% VAT)</option>
                  <option value="zero_rated">Zero Rated (0%)</option>
                </select>
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Cost/Wholesale Price (SAR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.wholesale_price_sar}
                  onChange={(e) => updateForm("wholesale_price_sar", e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Selling Price — Gross incl. 15% VAT (SAR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.retail_price_sar}
                  onChange={(e) => updateForm("retail_price_sar", e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                {vatPreview && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-mono">
                    Net: {vatPreview.net.toFixed(2)} + VAT: {vatPreview.vat.toFixed(2)} = {vatPreview.gross.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Stock */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Current Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onChange={(e) => updateForm("stock_quantity", e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold text-sm transition-colors"
              >
                {isSubmitting ? "Saving..." : "Save Product"}
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

        {/* Inventory Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
              Product Catalog ({items.length} items)
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
              Loading inventory...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
              No products found. Click &ldquo;+ Add Product&rdquo; to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Product
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      SKU / Barcode
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Category
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Cost (SAR)
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Sell Price (SAR)
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      Stock
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                      VAT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">
                          {item.item_name}
                        </p>
                        {item.item_name_ar && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500" dir="rtl">
                            {item.item_name_ar}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        <p>{item.sku}</p>
                        {item.barcode && (
                          <p className="text-zinc-400 dark:text-zinc-500">{item.barcode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {item.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {item.wholesale_price_sar.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {item.retail_price_sar.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono font-medium ${
                            item.stock_quantity <= item.reorder_level
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          {item.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            item.vat_category === "standard"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          }`}
                        >
                          {item.vat_category === "standard" ? "15%" : "0%"}
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
