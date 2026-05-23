import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import pool from "@/lib/db";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local (server-side only)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT id, email, full_name, role, is_active, created_at
      FROM user_profiles
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ users: result.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch staff", detail: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

interface CreateStaffRequest {
  full_name: string;
  email: string;
  password: string;
  role?: "admin" | "cashier";
}

export async function POST(request: NextRequest) {
  let body: CreateStaffRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { full_name, email, password, role = "cashier" } = body;

  if (!full_name || full_name.trim().length === 0) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  if (!["admin", "cashier"].includes(role)) {
    return NextResponse.json(
      { error: "Role must be 'admin' or 'cashier'" },
      { status: 400 }
    );
  }

  try {
    const adminClient = getAdminClient();

    const { data, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        role,
      },
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: full_name.trim(),
        role,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create user", detail: message },
      { status: 500 }
    );
  }
}
