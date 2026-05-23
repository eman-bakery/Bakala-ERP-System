import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const status = searchParams.get("status");
  const allShifts = searchParams.get("all") === "true";

  const client = await pool.connect();

  try {
    let query: string;
    let params: (string | null)[] = [];

    if (allShifts) {
      query = `
        SELECT s.*, up.full_name, up.email
        FROM shifts s
        LEFT JOIN user_profiles up ON up.id = s.user_id
        ORDER BY s.opened_at DESC
        LIMIT 50
      `;
    } else if (userId && status) {
      query = `
        SELECT s.*, up.full_name, up.email
        FROM shifts s
        LEFT JOIN user_profiles up ON up.id = s.user_id
        WHERE s.user_id = $1 AND s.status = $2
        ORDER BY s.opened_at DESC
      `;
      params = [userId, status];
    } else if (userId) {
      query = `
        SELECT s.*, up.full_name, up.email
        FROM shifts s
        LEFT JOIN user_profiles up ON up.id = s.user_id
        WHERE s.user_id = $1
        ORDER BY s.opened_at DESC
        LIMIT 20
      `;
      params = [userId];
    } else {
      query = `
        SELECT s.*, up.full_name, up.email
        FROM shifts s
        LEFT JOIN user_profiles up ON up.id = s.user_id
        ORDER BY s.opened_at DESC
        LIMIT 50
      `;
    }

    const result = await client.query(query, params);

    const shifts = result.rows.map((row) => ({
      ...row,
      starting_cash_sar: row.starting_cash / 100,
      expected_cash_sar: row.expected_cash / 100,
      actual_cash_sar: row.actual_cash / 100,
      discrepancy_sar: row.discrepancy / 100,
    }));

    return NextResponse.json({ shifts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch shifts", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

interface OpenShiftRequest {
  user_id: string;
  starting_cash_sar: number;
}

interface CloseShiftRequest {
  shift_id: string;
  actual_cash_sar: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  let body: OpenShiftRequest | CloseShiftRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // Determine if opening or closing a shift
    if ("shift_id" in body) {
      // CLOSE SHIFT
      const { shift_id, actual_cash_sar, notes } = body as CloseShiftRequest;

      if (!shift_id) {
        return NextResponse.json({ error: "shift_id is required" }, { status: 400 });
      }
      if (typeof actual_cash_sar !== "number" || actual_cash_sar < 0) {
        return NextResponse.json({ error: "actual_cash_sar must be non-negative" }, { status: 400 });
      }

      await client.query("BEGIN");

      // Get the shift
      const shiftRes = await client.query(
        "SELECT * FROM shifts WHERE id = $1 AND status = 'open'",
        [shift_id]
      );

      if (shiftRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Open shift not found" }, { status: 404 });
      }

      const shift = shiftRes.rows[0];

      // Calculate expected cash: starting_cash + sum of all cash POS sales during this shift
      const salesRes = await client.query(
        `SELECT COALESCE(SUM(total_gross_amount), 0) AS total_sales
         FROM transactions
         WHERE status = 'completed'
           AND payment_method = 'cash'
           AND transaction_date >= $1
           AND ($2::uuid IS NULL OR cashier_id = $2 OR cashier_id IS NULL)`,
        [shift.opened_at, shift.user_id]
      );

      const totalSalesHalalas = parseInt(salesRes.rows[0].total_sales);
      const expectedCash = shift.starting_cash + totalSalesHalalas;
      const actualCashHalalas = Math.round(actual_cash_sar * 100);
      const discrepancy = actualCashHalalas - expectedCash;

      // Update the shift
      const updateRes = await client.query(
        `UPDATE shifts SET
          status = 'closed',
          closed_at = now(),
          expected_cash = $1,
          actual_cash = $2,
          discrepancy = $3,
          notes = $4
        WHERE id = $5
        RETURNING *`,
        [expectedCash, actualCashHalalas, discrepancy, notes || null, shift_id]
      );

      await client.query("COMMIT");

      const closed = updateRes.rows[0];

      return NextResponse.json({
        success: true,
        action: "closed",
        shift: {
          id: closed.id,
          status: closed.status,
          opened_at: closed.opened_at,
          closed_at: closed.closed_at,
          starting_cash_sar: closed.starting_cash / 100,
          total_sales_sar: totalSalesHalalas / 100,
          expected_cash_sar: expectedCash / 100,
          actual_cash_sar: actualCashHalalas / 100,
          discrepancy_sar: discrepancy / 100,
        },
      });
    } else {
      // OPEN SHIFT
      const { user_id, starting_cash_sar } = body as OpenShiftRequest;

      if (!user_id) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 });
      }
      if (typeof starting_cash_sar !== "number" || starting_cash_sar < 0) {
        return NextResponse.json({ error: "starting_cash_sar must be non-negative" }, { status: 400 });
      }

      // Check for existing open shift
      const existingRes = await client.query(
        "SELECT id FROM shifts WHERE user_id = $1 AND status = 'open'",
        [user_id]
      );

      if (existingRes.rows.length > 0) {
        return NextResponse.json(
          { error: "You already have an open shift. Close it before opening a new one." },
          { status: 409 }
        );
      }

      const startingHalalas = Math.round(starting_cash_sar * 100);

      const insertRes = await client.query(
        `INSERT INTO shifts (user_id, starting_cash, status)
         VALUES ($1, $2, 'open')
         RETURNING *`,
        [user_id, startingHalalas]
      );

      const opened = insertRes.rows[0];

      return NextResponse.json({
        success: true,
        action: "opened",
        shift: {
          id: opened.id,
          status: opened.status,
          opened_at: opened.opened_at,
          starting_cash_sar: opened.starting_cash / 100,
        },
      }, { status: 201 });
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Shift operation failed", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
