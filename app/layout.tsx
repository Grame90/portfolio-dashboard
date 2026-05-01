import type { Metadata } from "next";
import Script from "next/script";
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
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){try{
  var t=localStorage.getItem('dashboard-theme')||'purple';
  if(t==='light')t='light-purple';
  var LB={'--bg-primary':'#f0f2f8','--bg-secondary':'#e5e8f4','--bg-card':'#ffffff','--bg-card-hover':'#f7f8fc','--border':'#d0d4e8','--text-primary':'#0d0d22','--text-secondary':'#4a5070','--text-muted':'#8890b0','--green':'#16a34a','--red':'#dc2626','--yellow':'#b45309','--blue':'#1d4ed8'};
  var LA={'purple':{'--accent':'#6d28d9','--accent-light':'#7c3aed'},'blue':{'--accent':'#1d4ed8','--accent-light':'#2563eb'},'green':{'--accent':'#15803d','--accent-light':'#16a34a'},'amber':{'--accent':'#b45309','--accent-light':'#d97706'}};
  var V={purple:{'--bg-primary':'#0a0a1a','--bg-secondary':'#111128','--bg-card':'#141430','--bg-card-hover':'#1a1a38','--border':'#1e1e45','--accent':'#7c3aed','--accent-light':'#9d6ef5','--text-primary':'#ffffff','--text-secondary':'#8888aa','--text-muted':'#555577','--green':'#22c55e','--red':'#ef4444','--yellow':'#f59e0b','--blue':'#3b82f6'},blue:{'--bg-primary':'#04080f','--bg-secondary':'#080f1c','--bg-card':'#0c1628','--bg-card-hover':'#101e35','--border':'#162040','--accent':'#1d6ef5','--accent-light':'#5a96f8','--text-primary':'#e8f0ff','--text-secondary':'#7a90b8','--text-muted':'#455570','--green':'#22c55e','--red':'#ef4444','--yellow':'#f59e0b','--blue':'#3b82f6'},green:{'--bg-primary':'#020d06','--bg-secondary':'#04140a','--bg-card':'#071a0e','--bg-card-hover':'#0c2216','--border':'#0f2d1b','--accent':'#16a34a','--accent-light':'#22c55e','--text-primary':'#e8ffe8','--text-secondary':'#6a9a78','--text-muted':'#3a5a45','--green':'#22c55e','--red':'#ef4444','--yellow':'#f59e0b','--blue':'#3b82f6'},amber:{'--bg-primary':'#0a0800','--bg-secondary':'#130f02','--bg-card':'#1a1403','--bg-card-hover':'#221b05','--border':'#2d2408','--accent':'#d97706','--accent-light':'#f59e0b','--text-primary':'#fff8e8','--text-secondary':'#a08858','--text-muted':'#605030','--green':'#22c55e','--red':'#ef4444','--yellow':'#f59e0b','--blue':'#3b82f6'}};
  var el=document.documentElement;
  el.setAttribute('data-theme',t);
  var vars;
  if(t.indexOf('light-')===0){var cid=t.replace('light-','');vars=Object.assign({},LB,LA[cid]||LA['purple']);}
  else{vars=V[t]||V['purple'];}
  Object.keys(vars).forEach(function(k){el.style.setProperty(k,vars[k]);});
}catch(e){}})();`}</Script>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  );
}
