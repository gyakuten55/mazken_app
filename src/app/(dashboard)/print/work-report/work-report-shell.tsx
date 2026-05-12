"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: number; name: string; code: string; color: string };

export function WorkReportShell({
  branches,
  initialDate,
  initialBranchId,
  children,
}: {
  branches: Branch[];
  initialDate: string;
  initialBranchId: number | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [branchId, setBranchId] = useState<number | null>(initialBranchId);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-work-report-print", "");
    styleEl.textContent = `@media print { @page { size: A4 landscape; margin: 8mm; } .no-print { display: none !important; } }`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, []);

  function navigate(newDate: string, newBranchId: number | null) {
    const params = new URLSearchParams();
    params.set("date", newDate);
    if (newBranchId != null) params.set("branchOfficeId", String(newBranchId));
    router.push(`/print/work-report?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gray-200 py-4">
      <div className="no-print sticky top-0 z-10 mx-auto max-w-[297mm] flex items-center gap-2 px-2 mb-2 bg-white border-b py-2 flex-wrap">
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
        <div className="ml-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">日付:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              navigate(e.target.value, branchId);
            }}
            className="h-9 px-2 border rounded-md text-sm"
          />
        </div>
        <div className="flex items-center gap-1 border-l pl-3 flex-wrap">
          <span className="text-xs text-muted-foreground">営業所:</span>
          <button
            onClick={() => {
              setBranchId(null);
              navigate(date, null);
            }}
            className={
              "px-3 h-9 border rounded text-xs font-medium " +
              (branchId === null ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")
            }
          >
            全営業所
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBranchId(b.id);
                navigate(date, b.id);
              }}
              className={
                "px-3 h-9 border rounded text-xs font-medium flex items-center gap-1 " +
                (branchId === b.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")
              }
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              {b.name}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
