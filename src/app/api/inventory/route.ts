import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const client = await pool.connect();

  try {
    const query = activeOnly
      ? `SELECT id, sku, barcode, item_name, item_name_ar, category, unit_of_measure,
                wholesale_price, retail_price, vat_category, stock_quantity, reorder_level, is_active,
                created_at, updated_at
         FROM inventory_items WHERE is_active = true ORDER BY item_name`
      : `SELECT id, sku, barcode, item_name, item_name_ar, category, unit_of_measure,
                wholesale_price, retail_price, vat_category, stock_quantity, reorder_level, is_active,
                created_at, updated_at
         FROM inventory_items ORDER BY item_name`;

    const result = await client.query(query);

    const items = result.rows.map((row) => ({
      ...row,
      wholesale_price_sar: row.wholesale_price / 100,
      retail_price_sar: row.retail_price / 100,
    }));

    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch inventory", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

interface CreateItemRequest {
  item_name: string;
  item_name_ar?: string;
  sku: string;
  barcode?: string;
  category?: string;
  unit_of_measure?: string;
  wholesale_price_sar: number;
  retail_price_sar: number;
  vat_category?: "standard" | "zero_rated";
  stock_quantity?: number;
  reorder_level?: number;
}

export async function POST(request: NextRequest) {
  let body: CreateItemRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    item_name,
    item_name_ar,
    sku,
    barcode,
    category,
    unit_of_measure = "piece",
    wholesale_price_sar,
    retail_price_sar,
    vat_category = "standard",
    stock_quantity = 0,
    reorder_level = 0,
  } = body;

  // Validation
  if (!item_name || typeof item_name !== "string" || item_name.trim().length === 0) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  if (!sku || typeof sku !== "string" || sku.trim().length === 0) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  if (typeof wholesale_price_sar !== "number" || wholesale_price_sar < 0) {
    return NextResponse.json(
      { error: "wholesale_price_sar must be a non-negative number" },
      { status: 400 }
    );
  }

  if (typeof retail_price_sar !== "number" || retail_price_sar <= 0) {
    return NextResponse.json(
      { error: "retail_price_sar must be a positive number (gross price including VAT)" },
      { status: 400 }
    );
  }

  // Convert SAR to halalas
  const wholesaleHalalas = Math.round(wholesale_price_sar * 100);
  const retailHalalas = Math.round(retail_price_sar * 100);

  const client = await pool.connect();

  try {
    const result = await client.query(
      `INSERT INTO inventory_items (
        item_name, item_name_ar, sku, barcode, category, unit_of_measure,
        wholesale_price, retail_price, vat_category, stock_quantity, reorder_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, sku, item_name, item_name_ar, wholesale_price, retail_price,
                vat_category, stock_quantity, created_at`,
      [
        item_name.trim(),
        item_name_ar?.trim() || null,
        sku.trim(),
        barcode?.trim() || null,
        category?.trim() || null,
        unit_of_measure,
        wholesaleHalalas,
        retailHalalas,
        vat_category,
        stock_quantity,
        reorder_level,
      ]
    );

    const item = result.rows[0];

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        wholesale_price_sar: item.wholesale_price / 100,
        retail_price_sar: item.retail_price / 100,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("duplicate key") || message.includes("unique")) {
      return NextResponse.json(
        { error: "SKU or barcode already exists", detail: message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create inventory item", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
