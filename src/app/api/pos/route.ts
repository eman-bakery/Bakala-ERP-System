import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

interface CartItem {
  id: string;
  name: string;
  price: number; // retail price in SAR (VAT-inclusive)
  quantity: number;
}

interface CheckoutRequest {
  items: CartItem[];
  payment_method: "cash" | "card";
  amount_paid?: number;
}

export async function POST(request: NextRequest) {
  let body: CheckoutRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, payment_method = "cash", amount_paid } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Cart must contain at least one item" },
      { status: 400 }
    );
  }

  for (const item of items) {
    if (!item.name || !item.price || !item.quantity || item.quantity < 1) {
      return NextResponse.json(
        { error: `Invalid item: ${JSON.stringify(item)}` },
        { status: 400 }
      );
    }
  }

  // Calculate totals per line and overall (all in halalas)
  const lineItems = items.map((item) => {
    const grossPerUnit = Math.round(item.price * 100);
    const grossLine = grossPerUnit * item.quantity;
    // Extract 15% VAT: Net = Gross / 1.15, rounded per line (ZATCA rule)
    const netPerUnit = Math.round(grossPerUnit / 1.15);
    const netLine = netPerUnit * item.quantity;
    const vatLine = grossLine - netLine;

    return {
      ...item,
      grossPerUnit,
      netPerUnit,
      grossLine,
      netLine,
      vatLine,
    };
  });

  const totalGross = lineItems.reduce((sum, l) => sum + l.grossLine, 0);
  const totalNet = lineItems.reduce((sum, l) => sum + l.netLine, 0);
  const totalVat = totalGross - totalNet;

  const paidHalalas = amount_paid
    ? Math.round(amount_paid * 100)
    : totalGross;
  const changeHalalas = Math.max(0, paidHalalas - totalGross);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get account IDs
    const creditAccountCode = payment_method === "card" ? "1010" : "1000";
    const accountsResult = await client.query(
      `SELECT id, account_code FROM chart_of_accounts 
       WHERE account_code = ANY($1)`,
      [[creditAccountCode, "4000", "2100"]]
    );

    const accountMap: Record<string, string> = {};
    for (const row of accountsResult.rows) {
      accountMap[row.account_code] = row.id;
    }

    const cashAccountId = accountMap[creditAccountCode];
    const revenueAccountId = accountMap["4000"];
    const vatPayableAccountId = accountMap["2100"];

    if (!cashAccountId || !revenueAccountId || !vatPayableAccountId) {
      throw new Error("Required accounts not found in chart_of_accounts");
    }

    // 2. Create the transaction record
    const txnResult = await client.query(
      `INSERT INTO transactions (
        transaction_type, status,
        subtotal_net_amount, total_vat_amount, total_gross_amount,
        payment_method, amount_paid, change_given
      ) VALUES ('sale', 'completed', $1, $2, $3, $4, $5, $6)
      RETURNING id, transaction_number`,
      [totalNet, totalVat, totalGross, payment_method, paidHalalas, changeHalalas]
    );

    const transactionId = txnResult.rows[0].id;
    const transactionNumber = txnResult.rows[0].transaction_number;

    // 3. Insert transaction lines with VAT isolation per item
    for (const line of lineItems) {
      await client.query(
        `INSERT INTO transaction_lines (
          transaction_id, description, quantity,
          unit_price, net_amount, vat_rate, vat_amount, gross_amount
        ) VALUES ($1, $2, $3, $4, $5, 0.1500, $6, $7)`,
        [
          transactionId,
          line.name,
          line.quantity,
          line.netPerUnit,
          line.netLine,
          line.vatLine,
          line.grossLine,
        ]
      );
    }

    // 4. Create journal entry (Double-Entry)
    const entryResult = await client.query(
      `INSERT INTO journal_entries (description, reference_type, reference_id, status)
       VALUES ($1, 'transaction', $2, 'draft')
       RETURNING id, entry_number`,
      [`POS Sale #${transactionNumber}`, transactionId]
    );

    const journalEntryId = entryResult.rows[0].id;
    const entryNumber = entryResult.rows[0].entry_number;

    // DEBIT: Cash/Bank (gross amount received)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, $4, 0)`,
      [journalEntryId, cashAccountId, `POS Sale #${transactionNumber} - Payment`, totalGross]
    );

    // CREDIT: Sales Revenue (net amount)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, 0, $4)`,
      [journalEntryId, revenueAccountId, `POS Sale #${transactionNumber} - Revenue`, totalNet]
    );

    // CREDIT: VAT Payable (output VAT collected)
    await client.query(
      `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, 0, $4)`,
      [journalEntryId, vatPayableAccountId, `POS Sale #${transactionNumber} - Output VAT`, totalVat]
    );

    // 5. Post the journal entry (triggers balance check)
    await client.query(
      `UPDATE journal_entries SET status = 'posted' WHERE id = $1`,
      [journalEntryId]
    );

    // 6. Link journal entry to transaction
    await client.query(
      `UPDATE transactions SET journal_entry_id = $1 WHERE id = $2`,
      [journalEntryId, transactionId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      transaction: {
        id: transactionId,
        number: transactionNumber,
        status: "completed",
      },
      journal_entry: {
        id: journalEntryId,
        entry_number: entryNumber,
        status: "posted",
      },
      receipt: {
        items: lineItems.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unit_price_sar: l.grossPerUnit / 100,
          line_total_sar: l.grossLine / 100,
          net_sar: l.netLine / 100,
          vat_sar: l.vatLine / 100,
        })),
        subtotal_net_sar: totalNet / 100,
        total_vat_sar: totalVat / 100,
        total_gross_sar: totalGross / 100,
        amount_paid_sar: paidHalalas / 100,
        change_sar: changeHalalas / 100,
        payment_method,
        vat_rate: "15%",
      },
      double_entry: {
        debits: [
          {
            account: payment_method === "card" ? "Bank - Main Account" : "Cash",
            amount_sar: totalGross / 100,
          },
        ],
        credits: [
          { account: "Sales Revenue", amount_sar: totalNet / 100 },
          { account: "VAT Payable", amount_sar: totalVat / 100 },
        ],
        balanced: true,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Checkout failed", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
