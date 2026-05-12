"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const ALL_COLUMNS = [
  { key: "date", label: "日付" },
  { key: "staffCode", label: "社員コード" },
  { key: "staffName", label: "スタッフ名" },
  { key: "branchOffice", label: "営業所" },
  { key: "insuranceType", label: "保険種別" },
  { key: "siteCode", label: "現場コード" },
  { key: "siteName", label: "現場名" },
  { key: "clientName", label: "元請け" },
  { key: "assignmentType", label: "区分（通い/出張）" },
  { key: "startTime", label: "開始時間" },
  { key: "endTime", label: "終了時間" },
];

export default function ExportPage() {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    ALL_COLUMNS.map((c) => c.key)
  );
  const [loading, setLoading] = useState(false);

  function toggleColumn(key: string) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          columns: selectedColumns,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `staff_assignment_export_${startDate}_${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("CSVを出力しました");
      } else {
        toast.error("出力に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div className="border-b bg-card px-4 md:px-6 py-4">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1">
          <Link href="/calendar" className="hover:text-foreground transition-colors">ホーム</Link>
        </span>
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 opacity-40" />
          <span className="text-foreground font-medium">CSV出力</span>
        </span>
      </nav>
      <h1 className="text-xl font-bold tracking-tight">CSV出力</h1>
    </div>

    <div className="px-4 md:px-6 py-6">
      <div className="max-w-xl bg-card rounded-xl border shadow-sm p-4 md:p-6">
        <div className="space-y-6">
          <div className="form-section">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">期間</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>開始日</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">出力列</h2>
            <div className="grid grid-cols-2 gap-3">
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleExport} disabled={loading} className="w-full" size="lg">
            <Download className="h-4 w-4 mr-2" />
            {loading ? "出力中..." : "CSVをダウンロード"}
          </Button>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <p className="font-medium mb-1">CSV出力について</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>UTF-8 BOM形式でExcelで文字化けなく開けます</li>
              <li>営業所コードは英数字（HQ, TKS等）で出力されます</li>
              <li>日曜日は除外されます</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
