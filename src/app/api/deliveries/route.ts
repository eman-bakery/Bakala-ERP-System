import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const client = await pool.connect();

  try {
    // Deliveries with supplier info
    const deliveriesRes = await client.query(`
      SELECT d.*, s.name AS supplier_name, s.name_ar AS supplier_name_ar
      FROM deliveries d
      JOIN suppliers s ON s.id = d.supplier_id
      ORDER BY d.delivery_date DESC, d.created_at DESC
      LIMIT 50
    `);

    // Accounts Payable summary
    const apRes = await client.query(`
      SELECT
        COALESCE(SUM(total_cost), 0) AS total_unpaid,
        COUNT(*) AS unpaid_count
      FROM deliveries
      WHERE payment_status = 'unpaid'
    `);

    // Suppliers list (for the form)
    const suppliersRes = await client.query(
      "SELECT id, name, name_ar FROM suppliers WHERE is_active = true ORDER BY name"
    );

    const deliveries = deliveriesRes.rows.map((row) => ({
      ...row,
      total_cost_sar: row.total_cost / 100,
    }));

    return NextResponse.json({
      deliveries,
      accounts_payable: {
        total_unpaid_sar: parseInt(apRes.rows[0].total_unpaid) / 100,
        unpaid_count: parseInt(apRes.rows[0].unpaid_count),
      },
      suppliers: suppliersRes.rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch deliveries", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

interface DeliveryItem {
  inventory_item_id: string;
  quantity: number;
  unit_cost_sar?: number;
}

interface CreateDeliveryRequest {
  supplier_id: string;
  total_cost_sar: number;
  payment_status?: "paid" | "unpaid";
  delivery_date?: string;
  items: DeliveryItem[];
  notes?: string;
}

export async function POST(request: NextRequest) {
  let body: CreateDeliveryRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    supplier_id,
    total_cost_sar,
    payment_status = "unpaid",
    delivery_date,
    items,
    notes,
  } = body;

  if (!supplier_id) {
    return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
  }
  if (typeof total_cost_sar !== "number" || total_cost_sar < 0) {
    return NextResponse.json({ error: "total_cost_sar must be non-negative" }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one delivery item is required" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.inventory_item_id || !item.quantity || item.quantity < 1) {
      return NextResponse.json(
        { error: "Each item must have inventory_item_id and quantity > 0" },
        { status: 400 }
      );
    }
  }

  const totalCostHalalas = Math.round(total_cost_sar * 100);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Insert delivery record
    const deliveryRes = await client.query(
      `INSERT INTO deliveries (supplier_id, total_cost, payment_status, delivery_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        supplier_id,
        totalCostHalalas,
        payment_status,
        delivery_date || new Date().toISOString().split("T")[0],
        notes || null,
      ]
    );

    const deliveryId = deliveryRes.rows[0].id;

    // 2. Insert delivery items AND update inventory stock
    for (const item of items) {
      const unitCostHalalas = item.unit_cost_sar
        ? Math.round(item.unit_cost_sar * 100)
        : 0;

      await client.query(
        `INSERT INTO delivery_items (delivery_id, inventory_item_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [deliveryId, item.inventory_item_id, item.quantity, unitCostHalalas]
      );

      // Update stock quantity
      await client.query(
        `UPDATE inventory_items
         SET stock_quantity = stock_quantity + $1
         WHERE id = $2`,
        [item.quantity, item.inventory_item_id]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      delivery: {
        id: deliveryId,
        total_cost_sar,
        payment_status,
        items_count: items.length,
        total_units: items.reduce((sum, i) => sum + i.quantity, 0),
      },
    }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to record delivery", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
