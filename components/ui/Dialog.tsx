"use client";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: number;
}

export function Dialog({ open, onOpenChange, title, description, children, maxWidth = 480 }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          animation: "fadeIn 0.15s ease",
        }} />
        <RadixDialog.Content style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: `min(${maxWidth}px, calc(100vw - 32px))`,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          animation: "slideUp 0.18s ease",
          maxHeight: "90vh",
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: description ? 6 : 20 }}>
            <RadixDialog.Title style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center",
            }}>
              <X size={16} />
            </RadixDialog.Close>
          </div>
          {description && (
            <RadixDialog.Description style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
              {description}
            </RadixDialog.Description>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogTrigger = RadixDialog.Trigger;
