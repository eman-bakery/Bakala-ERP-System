import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await pool.connect();

  try {
    // Total Sales Revenue: sum of credits to revenue accounts (4xxx)
    const revenueResult = await client.query(`
      SELECT COALESCE(SUM(jl.credit_amount), 0) AS total_halalas
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.account_type = 'revenue'
        AND je.status = 'posted'
        AND jl.credit_amount > 0
    `);

    // Total Operational Expenses: sum of debits to expense accounts (5xxx)
    const expensesResult = await client.query(`
      SELECT COALESCE(SUM(jl.debit_amount), 0) AS total_halalas
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.account_type = 'expense'
        AND je.status = 'posted'
        AND jl.debit_amount > 0
    `);

    // Output VAT Collected: credits to VAT Payable (2100)
    const outputVatResult = await client.query(`
      SELECT COALESCE(SUM(jl.credit_amount), 0) AS total_halalas
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.account_code = '2100'
        AND je.status = 'posted'
        AND jl.credit_amount > 0
    `);

    // Input VAT Paid: debits to Input VAT (1400)
    const inputVatResult = await client.query(`
      SELECT COALESCE(SUM(jl.debit_amount), 0) AS total_halalas
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.account_code = '1400'
        AND je.status = 'posted'
        AND jl.debit_amount > 0
    `);

    // Low stock items (below 15 units)
    const lowStockResult = await client.query(`
      SELECT id, sku, item_name, item_name_ar, category, stock_quantity, reorder_level, retail_price
      FROM inventory_items
      WHERE is_active = true AND stock_quantity < 15
      ORDER BY stock_quantity ASC
    `);

    // Transaction count and recent transactions
    const txnCountResult = await client.query(`
      SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'
    `);

    const recentTxnResult = await client.query(`
      SELECT transaction_number, transaction_type, total_gross_amount, status, transaction_date
      FROM transactions
      WHERE status = 'completed'
      ORDER BY transaction_date DESC
      LIMIT 5
    `);

    const totalRevenue = parseInt(revenueResult.rows[0].total_halalas);
    const totalExpenses = parseInt(expensesResult.rows[0].total_halalas);
    const outputVat = parseInt(outputVatResult.rows[0].total_halalas);
    const inputVat = parseInt(inputVatResult.rows[0].total_halalas);
    const netProfit = totalRevenue - totalExpenses;
    const vatLiability = outputVat - inputVat;

    return NextResponse.json({
      metrics: {
        total_revenue: {
          halalas: totalRevenue,
          sar: totalRevenue / 100,
          label: "Total Sales Revenue",
          label_ar: "إجمالي إيرادات المبيعات",
        },
        total_expenses: {
          halalas: totalExpenses,
          sar: totalExpenses / 100,
          label: "Total Operational Expenses",
          label_ar: "إجمالي المصروفات التشغيلية",
        },
        net_profit: {
          halalas: netProfit,
          sar: netProfit / 100,
          label: "Net Profit",
          label_ar: "صافي الربح",
          is_positive: netProfit >= 0,
        },
        vat_liability: {
          halalas: vatLiability,
          sar: vatLiability / 100,
          label: "ZATCA VAT Liability",
          label_ar: "التزام ضريبة القيمة المضافة",
          output_vat_sar: outputVat / 100,
          input_vat_sar: inputVat / 100,
          is_positive: vatLiability >= 0,
        },
      },
      low_stock_alerts: lowStockResult.rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        item_name: row.item_name,
        item_name_ar: row.item_name_ar,
        category: row.category,
        stock_quantity: row.stock_quantity,
        reorder_level: row.reorder_level,
        retail_price_sar: row.retail_price / 100,
      })),
      summary: {
        total_transactions: parseInt(txnCountResult.rows[0].count),
        recent_transactions: recentTxnResult.rows.map((row) => ({
          number: row.transaction_number,
          type: row.transaction_type,
          total_sar: row.total_gross_amount / 100,
          status: row.status,
          date: row.transaction_date,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load dashboard data", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
