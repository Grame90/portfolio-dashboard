"use client";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { ReactNode } from "react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  children: ReactNode;
  disabled?: boolean;
}

export function Select({ value, onValueChange, placeholder, children, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger style={{
        display: "inline-flex", alignItems: "center", justifyContent: "space-between",
        gap: 6, width: "100%", padding: "7px 10px",
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
        cursor: "pointer", outline: "none",
        transition: "border-color 0.15s",
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon><ChevronDown size={14} style={{ color: "var(--text-muted)" }} /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 6,
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            zIndex: 9999, minWidth: "var(--radix-select-trigger-width)",
            maxHeight: 280, overflowY: "auto",
            animation: "fadeIn 0.12s ease",
          }}
        >
          <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixSelect.Item
      value={value}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 10px", fontSize: 13, borderRadius: 6,
        color: "var(--text-primary)", cursor: "pointer", outline: "none",
        userSelect: "none",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator><Check size={12} style={{ color: "var(--accent)" }} /></RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}

export function SelectGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <RadixSelect.Group>
      {label && <RadixSelect.Label style={{ padding: "4px 10px 2px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</RadixSelect.Label>}
      {children}
    </RadixSelect.Group>
  );
}
