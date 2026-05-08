"use client";

import * as React from "react";
import { AlertTriangle, Trash2, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Variant = "default" | "destructive" | "warning";

type ConfirmState = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void | Promise<void>;
};

type ConfirmContextValue = {
  open: (state: ConfirmState) => void;
};

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState | null>(null);
  const [busy, setBusy] = React.useState(false);

  const open = React.useCallback((s: ConfirmState) => {
    setState(s);
  }, []);

  const close = React.useCallback(() => {
    if (busy) return;
    setState(null);
  }, [busy]);

  const handleConfirm = React.useCallback(async () => {
    if (!state) return;
    setBusy(true);
    try {
      await state.onConfirm();
      setState(null);
    } finally {
      setBusy(false);
    }
  }, [state]);

  const variant = state?.variant ?? "default";
  const isDestructive = variant === "destructive";
  const isWarning = variant === "warning";

  const Icon = isDestructive ? Trash2 : isWarning ? AlertTriangle : CircleHelp;

  return (
    <ConfirmContext.Provider value={{ open }}>
      {children}
      <Dialog
        open={state !== null}
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        {state && (
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-md p-6 gap-5"
          >
            <DialogHeader className="items-start gap-4">
              <div
                className={
                  isDestructive
                    ? "w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
                    : isWarning
                      ? "w-12 h-12 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0"
                      : "w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
                }
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-2 flex-1">
                <DialogTitle className="text-lg font-bold leading-snug">
                  {state.title}
                </DialogTitle>
                {state.description && (
                  <DialogDescription className="text-[15px] leading-relaxed text-foreground/80 whitespace-pre-line">
                    {state.description}
                  </DialogDescription>
                )}
              </div>
            </DialogHeader>
            <DialogFooter className="-mx-6 -mb-6 p-4 gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={close}
                disabled={busy}
                className="min-w-24"
              >
                {state.cancelLabel ?? "キャンセル"}
              </Button>
              <Button
                variant={isDestructive ? "destructive" : "default"}
                size="lg"
                onClick={handleConfirm}
                disabled={busy}
                className="min-w-28"
              >
                {busy ? "処理中..." : (state.confirmLabel ?? "はい")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.open;
}
