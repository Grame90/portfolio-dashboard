"use client";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { ReactNode } from "react";

export const DropdownMenuRoot    = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

const itemStyle = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "7px 12px", fontSize: 13,
  color: "var(--text-primary)", cursor: "pointer",
  borderRadius: 6, outline: "none",
  userSelect: "none" as const,
};

export function DropdownMenuContent({ children, align = "end", minWidth = 200 }: {
  children: ReactNode; align?: "start" | "end" | "center"; minWidth?: number;
}) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={6}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 6,
          minWidth,
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          zIndex: 9000,
          animation: "fadeIn 0.12s ease",
        }}
      >
        {children}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({ children, onSelect, disabled }: {
  children: ReactNode; onSelect?: () => void; disabled?: boolean;
}) {
  return (
    <RadixDropdown.Item
      onSelect={onSelect}
      disabled={disabled}
      style={{ ...itemStyle, opacity: disabled ? 0.4 : 1 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </RadixDropdown.Item>
  );
}

export function DropdownMenuCheckItem({ children, checked, onCheckedChange }: {
  children: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <RadixDropdown.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      style={{ ...itemStyle, paddingLeft: 10 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ width: 16, height: 16, border: "1px solid var(--border)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: checked ? "var(--accent)" : "transparent", flexShrink: 0, transition: "all 0.12s" }}>
        <RadixDropdown.ItemIndicator><Check size={10} color="#fff" /></RadixDropdown.ItemIndicator>
      </span>
      {children}
    </RadixDropdown.CheckboxItem>
  );
}

export function DropdownMenuSeparator() {
  return <RadixDropdown.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <RadixDropdown.Label style={{ padding: "4px 12px 2px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </RadixDropdown.Label>
  );
}
