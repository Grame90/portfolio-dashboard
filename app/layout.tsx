import { ThemeProvider } from "@/components/ThemeProvider";
import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";


export const metadata: Metadata = {
  title: "Investment Dashboard",
  description: "Инвестиционный дашборд — управление портфелем",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0, background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        
        <ThemeProvider defaultTheme="purple">
          <ConditionalLayout>
          {children}
        </ConditionalLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
