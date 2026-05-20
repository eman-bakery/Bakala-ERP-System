import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase-middleware";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const ADMIN_ONLY_ROUTES = ["/", "/inventory"];
const CASHIER_ALLOWED_ROUTES = ["/pos", "/expenses"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static assets
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow public routes without auth
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const { supabase, response } = await createSupabaseMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch user role from user_profiles
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "cashier";

  // Admin has access to everything
  if (role === "admin") {
    return response;
  }

  // Cashier role restrictions
  if (role === "cashier") {
    const isAdminRoute = ADMIN_ONLY_ROUTES.includes(pathname);
    const isCashierAllowed = CASHIER_ALLOWED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (isAdminRoute && !isCashierAllowed) {
      return NextResponse.redirect(new URL("/pos", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
