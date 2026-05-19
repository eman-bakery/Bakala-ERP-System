"use client";

import { useState, useMemo } from "react";

const EXPENSE_CATEGORIES = [
  { value: "iqama", label: "Government Fees - Iqama (إقامة)", vatExempt: true },
  { value: "baladiya", label: "Government Fees - Baladiya (بلدية)", vatExempt: true },
  { value: "jawazat", label: "Government Fees - Jawazat (جوازات)", vatExempt: true },
  { value: "government_other", label: "Government Fees - Other (أخرى)", vatExempt: true },
  { value: "rent", label: "Rent Expense (إيجار)", vatExempt: false },
  { value: "utilities", label: "Utilities Expense (مرافق)", vatExempt: false },
  { value: "supplies", label: "Supplies Expense (مستلزمات)", vatExempt: false },
  { value: "maintenance", label: "Maintenance & Repairs (صيانة)", vatExempt: false },
  { value: "transportation", label: "Transportation & Delivery (نقل)", vatExempt: false },
  { value: "marketing", label: "Marketing & Advertising (تسويق)", vatExempt: false },
  { value: "miscellaneous", label: "Miscellaneous Expenses (متنوعة)", vatExempt: false },
];

interface SubmitResult {
  success: boolean;
  journal_entry?: { id: string; entry_number: number; status: string };
  breakdown?: {
    gross_sar: number;
    net_sar: number;
    vat_sar: number;
    vat_rate: string;
    category: string;
    payment_method: string;
  };
  double_entry?: {
    debits: { account: string; amount_sar: number }[];
    credits: { account: string; amount_sar: number }[];
    balanced: boolean;
  };
  error?: string;
  detail?: string;
}

export default function ExpensesPage() {
  const [grossAmount, setGrossAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.value === category);

  const vatBreakdown = useMemo(() => {
    const gross = parseFloat(grossAmount);
    if (!gross || gross <= 0 || !selectedCategory) {
      return null;
    }

    const grossHalalas = Math.round(gross * 100);

    if (selectedCategory.vatExempt) {
      return {
        gross: gross,
        net: gross,
        vat: 0,
        vatRate: "0%",
        isExempt: true,
      };
    }

    const netHalalas = Math.round(grossHalalas / 1.15);
    const vatHalalas = grossHalalas - netHalalas;

    return {
      gross: gross,
      net: netHalalas / 100,
      vat: vatHalalas / 100,
      vatRate: "15%",
      isExempt: false,
    };
  }, [grossAmount, selectedCategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gross_amount: parseFloat(grossAmount),
          description: description.trim(),
          category,
          payment_method: paymentMethod,
        }),
      });

      const data: SubmitResult = await response.json();
      setResult(data);

      if (data.success) {
        setGrossAmount("");
        setDescription("");
        setCategory("");
        setPaymentMethod("cash");
      }
    } catch {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Operational Expense Entry
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            مخابز ايمان — &ldquo;The Taste of Tradition&rdquo;
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-6"
        >
          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Expense Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            >
              <option value="">— Select Category —</option>
              <optgroup label="🏛️ Government Fees (VAT Exempt - 0%)">
                {EXPENSE_CATEGORIES.filter((c) => c.vatExempt).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🏢 Commercial Expenses (VAT 15%)">
                {EXPENSE_CATEGORIES.filter((c) => !c.vatExempt).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Gross Amount */}
          <div>
            <label
              htmlFor="grossAmount"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Gross Amount (SAR) — Total paid including VAT
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">
                SAR
              </span>
              <input
                id="grossAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-12 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 text-lg font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Real-time VAT Breakdown */}
          {vatBreakdown && (
            <div className="rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3">
                Tax Split Preview (Real-time)
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Net Amount
                  </p>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {vatBreakdown.net.toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-400">SAR</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    VAT ({vatBreakdown.vatRate})
                  </p>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {vatBreakdown.vat.toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-400">SAR</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Gross Total
                  </p>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {vatBreakdown.gross.toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-400">SAR</p>
                </div>
              </div>
              {vatBreakdown.isExempt && (
                <p className="mt-3 text-xs text-center text-green-700 dark:text-green-400 font-medium">
                  ✓ Government fee — VAT exempt per KSA regulations
                </p>
              )}
              {!vatBreakdown.isExempt && (
                <p className="mt-3 text-xs text-center text-amber-700 dark:text-amber-400 font-medium">
                  Formula: Net = {vatBreakdown.gross.toFixed(2)} ÷ 1.15 ={" "}
                  {vatBreakdown.net.toFixed(2)} | VAT ={" "}
                  {vatBreakdown.gross.toFixed(2)} − {vatBreakdown.net.toFixed(2)}{" "}
                  = {vatBreakdown.vat.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g., Iqama renewal for employee #1042"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Payment Method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                  className="accent-amber-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Cash (النقدية)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={() => setPaymentMethod("bank")}
                  className="accent-amber-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Bank Transfer (تحويل بنكي)
                </span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !category || !grossAmount || !description}
            className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold py-3 px-4 transition-colors focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 outline-none"
          >
            {isSubmitting ? "Recording Entry..." : "Submit Expense"}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div
            className={`mt-6 rounded-xl border p-6 ${
              result.success
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
            }`}
          >
            {result.success ? (
              <>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-3">
                  ✓ Expense Recorded Successfully
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">Journal Entry #:</span>{" "}
                    {result.journal_entry?.entry_number}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">Status:</span>{" "}
                    <span className="text-green-700 dark:text-green-400 font-medium">
                      {result.journal_entry?.status}
                    </span>
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">Category:</span>{" "}
                    {result.breakdown?.category}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">VAT Rate:</span>{" "}
                    {result.breakdown?.vat_rate}
                  </p>
                </div>

                {/* Double Entry Visualization */}
                {result.double_entry && (
                  <div className="mt-4 border-t border-green-200 dark:border-green-800 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-2">
                      Double-Entry Ledger
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <p className="font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                          DEBITS
                        </p>
                        {result.double_entry.debits.map((d, i) => (
                          <p key={i} className="text-zinc-800 dark:text-zinc-200">
                            {d.account}: <span className="font-bold">{d.amount_sar.toFixed(2)}</span> SAR
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                          CREDITS
                        </p>
                        {result.double_entry.credits.map((c, i) => (
                          <p key={i} className="text-zinc-800 dark:text-zinc-200">
                            {c.account}: <span className="font-bold">{c.amount_sar.toFixed(2)}</span> SAR
                          </p>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-green-700 dark:text-green-400 font-medium">
                      ✓ Balanced: Debits = Credits
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                  ✗ Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400">
                  {result.error}
                </p>
                {result.detail && (
                  <p className="text-xs text-red-600 dark:text-red-500 mt-1 font-mono">
                    {result.detail}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
