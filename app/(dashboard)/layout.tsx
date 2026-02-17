"use client";

import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/nav";
import { ChatWidget } from "@/components/chat/chat-widget";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboardHome = pathname === "/";
  const isBudgetPlanner = pathname.startsWith("/budget-planner");
  const isSubscriptions = pathname.startsWith("/subscriptions");

  return (
    <div className="min-h-screen bg-background">
      {isDemoMode && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-700 dark:text-amber-400">
          Demo mode — data is simulated and read-only. Plaid syncing is disabled.
        </div>
      )}
      <DashboardNav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>
      {/* Floating chat only on routes that don't have their own embedded chat */}
      {!isDashboardHome && !isBudgetPlanner && !isSubscriptions && <ChatWidget />}
    </div>
  );
}
