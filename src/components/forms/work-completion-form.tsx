"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePadComponent } from "./signature-pad";
import { toast } from "sonner";
import { Printer, Save, PenLine, FileEdit, Lock, ArrowLeft, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteSelect } from "@/components/sites/site-select";

type StaffEntry = { name: string; insurance: string };

type FormData = {
  id?: number;
  jobSiteId: number;
  date: string;
  workContent: string | null;
  quantity: string | null;
  unit: string | null;
  staffNames: string | null;
  startTime: string | null;
  endTime: string | null;
  overtimeHours: number;
  clientSignature: string | null;
  clientName: string | null;
  isSubmitted: boolean;
  notes: string | null;
  jobSite?: {
    name: string;
    siteCode: string;
    clientName: string | null;
    address: string | null;
  };
};

type JobSite = {
  id: number;
  name: string;
  siteCode: string;
  clientName: string | null;
  address: string | null;
};

function parseDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const reiwa = d.getFullYear() - 2018;
  return { reiwa, month: d.getMonth() + 1, day: d.getDate() };
}

function parseStaffEntries(json: string | null): StaffEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.map((item: string | StaffEntry) =>
        typeof item === "string" ? { name: item, insurance: "社保" } : item
      );
    }
    return [];
  } catch {
    return [];
  }
}

// ===== 印刷レイアウト（画面プレビュー＆印刷兼用）=====
function PrintPreview({
  form,
  selectedSite,
  validStaff,
  dateInfo,
  showOnScreen,
}: {
  form: {
    workContent: string;
    quantity: string;
    unit: string;
    startTime: string;
    endTime: string;
    overtimeHours: number;
    clientSignature: string | null;
  };
  selectedSite: JobSite | undefined;
  validStaff: StaffEntry[];
  dateInfo: { reiwa: number; month: number; day: number };
  showOnScreen: boolean;
}) {
  return (
    <div
      className={cn(
        "print-form w-full max-w-[210mm] mx-auto text-[11px] text-black bg-white p-6",
        showOnScreen ? "block border rounded-lg shadow-sm" : "hidden print:block"
      )}
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          .print-form, .print-form * { visibility: visible; }
          .print-form { position: fixed; left: 0; top: 0; width: 100%; }
        }
        .pf-cell { border: 1.5px solid #c00; padding: 3px 6px; }
        .pf-header { border: 1.5px solid #c00; padding: 2px 6px; font-weight: bold; color: #c00; font-size: 9px; text-align: center; }
        .pf-val { font-size: 13px; color: #000; font-weight: 500; }
        .pf-blue { color: #00008b; }
      `}</style>

      <div className="flex justify-between items-start mb-2">
        <div className="text-left text-[10px] text-red-700 font-bold">
          出来高確認書控<br />
          <span className="text-[9px] font-normal">（経理用）</span>
        </div>
        <div className="text-right text-[9px]">
          <div className="font-bold text-red-700">株式会社マツケン</div>
          <div>〒571-0046 大阪府門真市本町21番21号</div>
          <div>TEL (06) 6903-3200 / FAX (06) 6903-3296</div>
        </div>
      </div>

      <table className="w-full border-collapse mb-3" style={{ border: "2px solid #c00" }}>
        <tbody>
          <tr>
            <td className="pf-header w-[50px]">宛先</td>
            <td className="pf-cell pf-val pf-blue" colSpan={3}>
              ㈱{selectedSite?.clientName || "---"} 様
            </td>
            <td className="pf-header w-[50px]">日付</td>
            <td className="pf-cell pf-val pf-blue text-center" colSpan={2}>
              令和 {dateInfo.reiwa}年 {dateInfo.month}月 {dateInfo.day}日
            </td>
          </tr>
          <tr>
            <td className="pf-header">現場名</td>
            <td className="pf-cell pf-val pf-blue" colSpan={6}>
              {selectedSite?.name || "---"}
            </td>
          </tr>
          <tr>
            <td className="pf-header">作業<br />内容</td>
            <td className="pf-cell pf-val pf-blue" colSpan={6}>
              {form.workContent || "---"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="flex gap-3 mb-3">
        <table className="border-collapse flex-1" style={{ border: "2px solid #c00" }}>
          <thead>
            <tr>
              <td className="pf-header w-[30px]">No</td>
              <td className="pf-header">作業者名</td>
              <td className="pf-header w-[60px]">種別</td>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(validStaff.length, 6) }).map((_, i) => (
              <tr key={i}>
                <td className="pf-cell text-center text-red-700 text-[9px]">{i + 1}</td>
                <td className="pf-cell pf-val pf-blue">{validStaff[i]?.name || ""}</td>
                <td className="pf-cell pf-val pf-blue text-center text-[10px]">{validStaff[i]?.insurance || ""}</td>
              </tr>
            ))}
            <tr>
              <td className="pf-header" colSpan={2}>計</td>
              <td className="pf-cell pf-val pf-blue text-center font-bold">{validStaff.length}名</td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-col gap-3 w-[200px]">
          <table className="border-collapse" style={{ border: "2px solid #c00" }}>
            <tbody>
              <tr><td className="pf-header">数量</td><td className="pf-cell pf-val pf-blue text-center">{form.quantity} {form.unit}</td></tr>
              <tr><td className="pf-header">単価</td><td className="pf-cell pf-val"></td></tr>
              <tr><td className="pf-header">金額</td><td className="pf-cell pf-val"></td></tr>
            </tbody>
          </table>
          <table className="border-collapse" style={{ border: "2px solid #c00" }}>
            <tbody>
              <tr><td className="pf-header">始業</td><td className="pf-cell pf-val pf-blue text-center">{form.startTime}</td></tr>
              <tr><td className="pf-header">終業</td><td className="pf-cell pf-val pf-blue text-center">{form.endTime}</td></tr>
              <tr><td className="pf-header">残業</td><td className="pf-cell pf-val pf-blue text-center">{Number(form.overtimeHours) > 0 ? `${form.overtimeHours}h` : ""}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <table className="w-full border-collapse" style={{ border: "2px solid #c00" }}>
        <tbody>
          <tr>
            <td className="pf-header w-[50px]">サイン</td>
            <td className="pf-cell" style={{ height: 80 }}>
              {form.clientSignature && (
                <img src={form.clientSignature} alt="サイン" className="h-[70px] object-contain" />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ===== メインコンポーネント =====
export function WorkCompletionFormComponent({
  form: existingForm,
  sites,
  prefill,
}: {
  form?: FormData;
  sites: JobSite[];
  prefill?: { jobSiteId?: number; date?: string };
}) {
  const router = useRouter();
  const isEdit = !!existingForm?.id;
  const isSigned = !!(existingForm?.clientSignature);
  const [loading, setLoading] = useState(false);
  const [sitesList, setSitesList] = useState(sites);

  // 署名済みなら閲覧モード固定、未署名なら入力→サインの流れ
  const [mode, setMode] = useState<"edit" | "sign" | "preview">(
    isSigned ? "preview" : "edit"
  );

  const [form, setForm] = useState({
    jobSiteId: prefill?.jobSiteId || existingForm?.jobSiteId || (sites[0]?.id ?? 0),
    date: prefill?.date || existingForm?.date || new Date().toISOString().split("T")[0],
    workContent: existingForm?.workContent || "",
    quantity: existingForm?.quantity || "",
    unit: existingForm?.unit || "m²",
    startTime: existingForm?.startTime || "08:00",
    endTime: existingForm?.endTime || "17:00",
    overtimeHours: existingForm?.overtimeHours || 0,
    clientSignature: existingForm?.clientSignature || null,
    clientName: existingForm?.clientName || "",
    notes: existingForm?.notes || "",
  });

  const [staffEntries, setStaffEntries] = useState<StaffEntry[]>(() => {
    const parsed = parseStaffEntries(existingForm?.staffNames ?? null);
    return parsed.length > 0 ? parsed : [{ name: "", insurance: "社保" }];
  });

  function update(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateStaff(index: number, field: keyof StaffEntry, value: string) {
    setStaffEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addStaffRow() {
    setStaffEntries((prev) => [...prev, { name: "", insurance: "社保" }]);
  }

  function removeStaffRow(index: number) {
    setStaffEntries((prev) => prev.filter((_, i) => i !== index));
  }

  const [loadingCalendar, setLoadingCalendar] = useState(false);

  async function loadFromCalendar() {
    if (!form.jobSiteId || !form.date) {
      toast.error("現場と日付を選択してください");
      return;
    }
    setLoadingCalendar(true);
    try {
      const res = await fetch(`/api/assignments?jobSiteId=${form.jobSiteId}&date=${form.date}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length === 0) {
        toast.info("この日この現場に配置がありません");
        return;
      }
      const entries: StaffEntry[] = data.map((ad: { assignment: { staff: { name: string; insuranceType: string }; startTime: string; endTime: string } }) => ({
        name: ad.assignment.staff.name,
        insurance: ad.assignment.staff.insuranceType === "company" ? "社保" : "一人親方",
      }));
      setStaffEntries(entries);
      // Auto-fill time from first assignment
      const firstAssignment = data[0].assignment;
      if (firstAssignment.startTime) update("startTime", firstAssignment.startTime);
      if (firstAssignment.endTime) update("endTime", firstAssignment.endTime);
      toast.success(`${entries.length}名のスタッフを読み込みました`);
    } catch {
      toast.error("読み込みに失敗しました");
    } finally {
      setLoadingCalendar(false);
    }
  }

  const selectedSite = sitesList.find((s) => s.id === form.jobSiteId);
  const validStaff = staffEntries.filter((s) => s.name.trim());
  const dateInfo = parseDate(form.date);

  async function handleSave() {
    setLoading(true);
    try {
      const body = {
        ...form,
        staffNames: JSON.stringify(validStaff),
        overtimeHours: Number(form.overtimeHours),
        isSubmitted: !!form.clientSignature,
      };
      const url = isEdit ? `/api/forms/${existingForm!.id}` : "/api/forms";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success("保存しました");
        if (!isEdit) {
          const data = await res.json();
          router.push(`/forms/${data.id}`);
        }
        router.refresh();
      } else {
        toast.error("保存に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleSaveAndPrint() {
    setLoading(true);
    try {
      const body = {
        ...form,
        staffNames: JSON.stringify(validStaff),
        overtimeHours: Number(form.overtimeHours),
        isSubmitted: !!form.clientSignature,
      };
      const url = isEdit ? `/api/forms/${existingForm!.id}` : "/api/forms";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success("保存しました");
        if (!isEdit) {
          const data = await res.json();
          router.push(`/forms/${data.id}`);
        }
        router.refresh();
        setTimeout(() => window.print(), 300);
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // 共通の印刷プレビューprops
  const previewProps = { form, selectedSite, validStaff, dateInfo };

  // ===================== SCREEN LAYOUT =====================
  return (
    <div>
      {/* 印刷時のみ表示される（画面では非表示） */}
      <PrintPreview {...previewProps} showOnScreen={false} />

      <div className="print:hidden space-y-4 max-w-2xl">

        {/* ===== 署名済み → 閲覧プレビューモード ===== */}
        {mode === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <span>この確認書は署名済みのため編集できません。</span>
            </div>

            {/* 印刷レイアウトをそのまま画面プレビュー */}
            <PrintPreview {...previewProps} showOnScreen={true} />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                一覧に戻る
              </Button>
              <Button size="sm" onClick={handlePrint} className="ml-auto">
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                印刷
              </Button>
            </div>
          </div>
        )}

        {/* ===== 入力モード ===== */}
        {mode === "edit" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex border rounded-lg overflow-hidden">
                <button className="px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 bg-primary text-primary-foreground">
                  <FileEdit className="h-3.5 w-3.5" />
                  入力
                </button>
                <button
                  onClick={() => setMode("sign")}
                  className="px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 hover:bg-muted border-l"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  サイン
                </button>
              </div>
              <div className="ml-auto">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={loading}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  保存
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">宛先（現場）</Label>
                  <SiteSelect
                    sites={sitesList}
                    value={form.jobSiteId}
                    onChange={(id) => update("jobSiteId", id)}
                    onSiteCreated={(site) => setSitesList((prev) => [...prev, { id: site.id, name: site.name, siteCode: site.siteCode, clientName: site.clientName ?? null, address: null }])}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">日付</Label>
                  <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">作業内容</Label>
                <Input value={form.workContent} onChange={(e) => update("workContent", e.target.value)} placeholder="雑工、足場組立等" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">数量</Label>
                  <Input value={form.quantity} onChange={(e) => update("quantity", e.target.value)} placeholder="49" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">単位</Label>
                  <Input value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder="m²" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">残業(h)</Label>
                  <Input type="number" step="0.5" value={form.overtimeHours} onChange={(e) => update("overtimeHours", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">始業</Label>
                  <Input type="time" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">終業</Label>
                  <Input type="time" value={form.endTime} onChange={(e) => update("endTime", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">作業者 ({validStaff.length}名)</Label>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadFromCalendar}
                    disabled={loadingCalendar || !form.jobSiteId}
                    className="text-xs"
                  >
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {loadingCalendar ? "読込中..." : "カレンダーから読込"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={addStaffRow}>+ 追加</Button>
                </div>
              </div>
              <div className="space-y-2">
                {staffEntries.map((entry, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <Input
                      value={entry.name}
                      onChange={(e) => updateStaff(i, "name", e.target.value)}
                      placeholder="氏名"
                      className="flex-1"
                    />
                    <select
                      value={entry.insurance}
                      onChange={(e) => updateStaff(i, "insurance", e.target.value)}
                      className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm w-[90px]"
                    >
                      <option value="社保">社保</option>
                      <option value="一人親方">一人親方</option>
                    </select>
                    {staffEntries.length > 1 && (
                      <button onClick={() => removeStaffRow(i)} className="text-muted-foreground hover:text-destructive text-xs px-1">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => setMode("sign")} className="w-full" variant="outline">
              <PenLine className="h-4 w-4 mr-2" />
              入力完了 → サインへ
            </Button>
          </div>
        )}

        {/* ===== サインモード ===== */}
        {mode === "sign" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setMode("edit")}
                  className="px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 hover:bg-muted"
                >
                  <FileEdit className="h-3.5 w-3.5" />
                  入力
                </button>
                <button className="px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 bg-primary text-primary-foreground border-l">
                  <PenLine className="h-3.5 w-3.5" />
                  サイン
                </button>
              </div>
            </div>

            <div className="border-2 border-red-200 rounded-lg bg-white overflow-hidden">
              <div className="bg-red-50 px-4 py-2 flex items-center justify-between border-b border-red-200">
                <div>
                  <div className="text-xs text-red-700 font-bold">出来高確認書</div>
                  <div className="text-[10px] text-red-500">株式会社マツケン</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">
                    令和{dateInfo.reiwa}年{dateInfo.month}月{dateInfo.day}日
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 space-y-3 text-sm">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] text-red-700 mb-0.5">宛先</div>
                    <div className="font-bold text-base">㈱{selectedSite?.clientName || "---"} 様</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-red-700 mb-0.5">現場名</div>
                    <div className="font-bold">{selectedSite?.name || "---"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-red-700 mb-0.5">作業内容</div>
                  <div className="font-medium">{form.workContent || "---"}</div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-[10px] text-red-700 mb-0.5">数量</div>
                    <div className="font-bold text-lg">{form.quantity} {form.unit}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-red-700 mb-0.5">時間</div>
                    <div>{form.startTime} ~ {form.endTime}</div>
                    {Number(form.overtimeHours) > 0 && (
                      <div className="text-xs text-muted-foreground">残業 {form.overtimeHours}h</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-red-700 mb-1">作業者 ({validStaff.length}名)</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {validStaff.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs">{i + 1}.</span>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground px-1 py-px bg-muted rounded">{s.insurance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-red-200 px-4 py-3">
                <div className="text-[10px] text-red-700 font-bold mb-2">
                  ご確認いただけましたら、以下にサインをお願いいたします
                </div>
                <SignaturePadComponent
                  value={form.clientSignature}
                  onChange={(data) => update("clientSignature", data)}
                  height={140}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                入力に戻る
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={loading}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  保存
                </Button>
                <Button size="sm" onClick={handleSaveAndPrint} disabled={loading || !form.clientSignature}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  保存して印刷
                </Button>
              </div>
            </div>
          </div>
        )}

        {mode !== "preview" && (
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground">
            ← 一覧に戻る
          </Button>
        )}
      </div>
    </div>
  );
}
