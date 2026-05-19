import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Expense categories and their VAT treatment.
 * Government fees in KSA are VAT-exempt (0%).
 * Standard commercial expenses include 15% VAT in the gross amount.
 */
const EXPENSE_CATEGORIES: Record<
  string,
  { accountCode: string; vatExempt: boolean; label: string }
> = {
  // Government fees — VAT exempt (0%)
  iqama: { accountCode: "5500", vatExempt: true, label: "Government Fees - Iqama" },
  baladiya: { accountCode: "5510", vatExempt: true, label: "Government Fees - Baladiya" },
  jawazat: { accountCode: "5520", vatExempt: true, label: "Government Fees - Jawazat" },
  government_other: { accountCode: "5530", vatExempt: true, label: "Government Fees - Other" },
  // Standard commercial expenses — 15% VAT inclusive
  rent: { accountCode: "5200", vatExempt: false, label: "Rent Expense" },
  utilities: { accountCode: "5300", vatExempt: false, label: "Utilities Expense" },
  supplies: { accountCode: "5400", vatExempt: false, label: "Supplies Expense" },
  maintenance: { accountCode: "5600", vatExempt: false, label: "Maintenance & Repairs" },
  transportation: { accountCode: "5700", vatExempt: false, label: "Transportation & Delivery" },
  marketing: { accountCode: "5800", vatExempt: false, label: "Marketing & Advertising" },
  miscellaneous: { accountCode: "5900", vatExempt: false, label: "Miscellaneous Expenses" },
};

interface ExpenseRequest {
  gross_amount: number;
  description: string;
  category: string;
  payment_method?: "cash" | "bank";
}

export async function POST(request: NextRequest) {
  let body: ExpenseRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { gross_amount, description, category, payment_method = "cash" } = body;

  // Validation
  if (!gross_amount || typeof gross_amount !== "number" || gross_amount <= 0) {
    return NextResponse.json(
      { error: "gross_amount must be a positive number (in SAR)" },
      { status: 400 }
    );
  }

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  if (!category || !EXPENSE_CATEGORIES[category]) {
    return NextResponse.json(
      {
        error: `Invalid category. Must be one of: ${Object.keys(EXPENSE_CATEGORIES).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const categoryConfig = EXPENSE_CATEGORIES[category];

  // Convert SAR to halalas (integer arithmetic)
  const grossHalalas = Math.round(gross_amount * 100);

  // VAT Calculation — ZATCA compliant
  let netHalalas: number;
  let vatHalalas: number;

  if (categoryConfig.vatExempt) {
    // Government fees: 0% VAT, gross = net
    netHalalas = grossHalalas;
    vatHalalas = 0;
  } else {
    // Standard 15% VAT: extract from gross
    // Net = Gross / 1.15, rounded to nearest halala
    netHalalas = Math.round(grossHalalas / 1.15);
    vatHalalas = grossHalalas - netHalalas;
  }

  // Determine credit account (where money comes from)
  const creditAccountCode = payment_method === "bank" ? "1010" : "1000";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create journal entry (draft first)
    const entryResult = await client.query(
      `INSERT INTO journal_entries (description, status)
       VALUES ($1, 'draft')
       RETURNING id, entry_number`,
      [`Expense: ${description} [${categoryConfig.label}]`]
    );
    const journalEntryId = entryResult.rows[0].id;
    const entryNumber = entryResult.rows[0].entry_number;

    // 2. Get account IDs
    const accountsResult = await client.query(
      `SELECT id, account_code FROM chart_of_accounts 
       WHERE account_code = ANY($1)`,
      [[categoryConfig.accountCode, "1400", creditAccountCode]]
    );

    const accountMap: Record<string, string> = {};
    for (const row of accountsResult.rows) {
      accountMap[row.account_code] = row.id;
    }

    const expenseAccountId = accountMap[categoryConfig.accountCode];
    const inputVatAccountId = accountMap["1400"];
    const creditAccountId = accountMap[creditAccountCode];

    if (!expenseAccountId || !creditAccountId) {
      throw new Error("Required accounts not found in chart_of_accounts");
    }

    // 3. Insert journal lines (Double-Entry)
    // DEBIT: Expense account (net amount)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, $4, 0)`,
      [journalEntryId, expenseAccountId, description, netHalalas]
    );

    // DEBIT: Input VAT account (if applicable)
    if (vatHalalas > 0 && inputVatAccountId) {
      await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
         VALUES ($1, $2, $3, $4, 0)`,
        [journalEntryId, inputVatAccountId, `VAT on: ${description}`, vatHalalas]
      );
    }

    // CREDIT: Cash or Bank (gross amount = net + vat)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, 0, $4)`,
      [journalEntryId, creditAccountId, `Payment: ${description}`, grossHalalas]
    );

    // 4. Post the journal entry (triggers balance check)
    await client.query(
      `UPDATE journal_entries SET status = 'posted' WHERE id = $1`,
      [journalEntryId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      journal_entry: {
        id: journalEntryId,
        entry_number: entryNumber,
        status: "posted",
      },
      breakdown: {
        gross_sar: gross_amount,
        net_sar: netHalalas / 100,
        vat_sar: vatHalalas / 100,
        vat_rate: categoryConfig.vatExempt ? "0%" : "15%",
        category: categoryConfig.label,
        payment_method: payment_method,
      },
      double_entry: {
        debits: [
          { account: categoryConfig.label, amount_sar: netHalalas / 100 },
          ...(vatHalalas > 0
            ? [{ account: "Input VAT (Recoverable)", amount_sar: vatHalalas / 100 }]
            : []),
        ],
        credits: [
          {
            account: payment_method === "bank" ? "Bank - Main Account" : "Cash",
            amount_sar: grossHalalas / 100,
          },
        ],
        balanced: true,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to record expense", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function GET() {
  return NextResponse.json({
    categories: Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => ({
      value: key,
      label: val.label,
      vat_exempt: val.vatExempt,
    })),
  });
}
