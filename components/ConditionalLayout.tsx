"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { DashboardProvider } from "@/lib/DashboardProvider";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { LayoutEditorProvider } from "@/components/LayoutEditor";
import MarketTicker, { TICKER_HEIGHT } from "@/components/MarketTicker";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMobile();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <LayoutEditorProvider>
      <MarketTicker />
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{
          marginLeft: isMobile ? 0 : 72,
          paddingTop: TICKER_HEIGHT,
          paddingBottom: isMobile ? 60 : 0,
          flex: 1,
          minHeight: "100vh",
          overflowY: "auto",
          overflowX: isMobile ? "hidden" : "auto",
          maxWidth: isMobile ? "100vw" : undefined,
        }}>
          {children}
        </main>
      </div>
    </LayoutEditorProvider>
  );
}

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");

  if (isAuth) {
    return (
      <DashboardProvider>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </DashboardProvider>
    );
  }

  return (
    <DashboardProvider>
      <TooltipProvider>
        <AuthGuard>
          {children}
        </AuthGuard>
      </TooltipProvider>
    </DashboardProvider>
  );
}
