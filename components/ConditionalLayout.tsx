"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { AppProvider } from "@/lib/AppContext";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");

  if (isAuth) {
    return (
      <AppProvider>
        {children}
      </AppProvider>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ marginLeft: 72, flex: 1, minHeight: "100vh", overflow: "auto" }}>
        <AppProvider>
          {children}
        </AppProvider>
      </main>
    </div>
  );
}
