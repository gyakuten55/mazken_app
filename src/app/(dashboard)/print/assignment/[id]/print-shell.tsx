"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AssignmentPrintShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-assignment-print-page", "");
    styleEl.textContent = `@media print { @page { size: A4 portrait; margin: 10mm; } .no-print { display: none !important; } }`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-200 py-6">
      <div className="no-print sticky top-2 z-10 mx-auto max-w-[210mm] flex items-center gap-2 px-2 mb-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90"
        >
          印刷
        </button>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border bg-white rounded-lg text-sm hover:bg-muted"
        >
          閉じる
        </button>
      </div>
      {children}
    </div>
  );
}
