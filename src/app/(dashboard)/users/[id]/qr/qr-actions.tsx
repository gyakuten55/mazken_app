"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Ban, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function QrActions({ userId, hasToken }: { userId: number; hasToken: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function regenerate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${userId}/regenerate-qr`, { method: "POST" });
      if (!res.ok) {
        toast.error("発行に失敗しました");
        return;
      }
      toast.success("QRコードを発行しました");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function revoke() {
    confirm({
      title: "QRログインを無効化しますか？",
      description: "このQRコードは以後使えなくなります。必要なら後で再発行できます。",
      confirmLabel: "無効化する",
      cancelLabel: "やめる",
      variant: "warning",
      onConfirm: async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/users/${userId}/regenerate-qr`, { method: "DELETE" });
          if (!res.ok) {
            toast.error("無効化に失敗しました");
            return;
          }
          toast.success("QRログインを無効化しました");
          router.refresh();
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={regenerate} disabled={busy} size="sm">
        <RefreshCw className="h-3.5 w-3.5 mr-2" />
        {hasToken ? "再発行" : "QR発行"}
      </Button>
      {hasToken && (
        <>
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Printer className="h-3.5 w-3.5 mr-2" />
            印刷
          </Button>
          <Button onClick={revoke} disabled={busy} variant="outline" size="sm">
            <Ban className="h-3.5 w-3.5 mr-2" />
            無効化
          </Button>
        </>
      )}
    </div>
  );
}
