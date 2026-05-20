"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import AppNav from "./AppNav";
import type { UserRole } from "@/lib/supabase-server";

interface AuthState {
  email: string;
  role: UserRole;
}

const NO_NAV_ROUTES = ["/login", "/auth/callback"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const pathname = usePathname();

  const isPublicRoute = NO_NAV_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (isPublicRoute) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (!cancelled) {
            setAuth({
              email: user.email || "",
              role: (profile?.role as UserRole) || "cashier",
            });
          }
        });
    });

    return () => { cancelled = true; };
  }, [isPublicRoute]);

  if (isPublicRoute || !auth) {
    return <>{children}</>;
  }

  return (
    <>
      <AppNav userEmail={auth.email} userRole={auth.role} />
      {children}
    </>
  );
}
