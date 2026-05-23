"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { UserRole } from "@/lib/supabase-server";

interface AppNavProps {
  userEmail: string;
  userRole: UserRole;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊", adminOnly: true },
  { href: "/pos", label: "POS", icon: "🛒", adminOnly: false },
  { href: "/inventory", label: "Inventory", icon: "📦", adminOnly: true },
  { href: "/expenses", label: "Expenses", icon: "💸", adminOnly: false },
  { href: "/staff", label: "Staff", icon: "👥", adminOnly: true },
];

export default function AppNav({ userEmail, userRole }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || userRole === "admin"
  );

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between print:hidden">
      <div className="flex items-center gap-1">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[160px]">
            {userEmail}
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-medium">
            {userRole}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
