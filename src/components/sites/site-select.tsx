"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

type JobSite = {
  id: number;
  name: string;
  siteCode: string;
  clientName?: string | null;
  branchOffice?: { color: string; name: string };
};

type BranchOffice = { id: number; name: string; code: string; color: string };

type CustomerOption = { id: number; code: string | null; name: string };

const INSURANCE_OPTIONS = [
  { value: "any", label: "指定なし" },
  { value: "company_only", label: "社保のみ" },
  { value: "national_only", label: "国保のみ" },
];

export function SiteSelect({
  sites: initialSites,
  value,
  onChange,
  onSiteCreated,
  autoFocus,
}: {
  sites: JobSite[];
  value: number;
  onChange: (siteId: number) => void;
  onSiteCreated?: (site: JobSite) => void;
  autoFocus?: boolean;
}) {
  const [sites, setSites] = useState(initialSites);
  useEffect(() => {
    setSites(initialSites);
  }, [initialSites]);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [branches, setBranches] = useState<BranchOffice[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const selectRef = useRef<HTMLSelectElement>(null);

  const [newSite, setNewSite] = useState({
    siteCode: "",
    name: "",
    customerId: 0,
    clientName: "",
    branchOfficeId: 0,
    address: "",
    contactName1: "",
    contactTel1: "",
    contactName2: "",
    contactTel2: "",
    contactName3: "",
    contactTel3: "",
    transportation: "",
    startDate: "",
    endDate: "",
    requiredInsurance: "any",
    notes: "",
    status: "active",
  });

  function upd(key: string, val: string | number) {
    setNewSite((p) => ({ ...p, [key]: val }));
  }

  useEffect(() => {
    if (autoFocus && !showNew) {
      setTimeout(() => selectRef.current?.focus(), 100);
    }
  }, [autoFocus, showNew]);

  // Fetch branch offices when opening the new form
  useEffect(() => {
    if (showNew && branches.length === 0) {
      fetch("/api/branches")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          setBranches(data);
          if (data.length > 0 && !newSite.branchOfficeId) {
            setNewSite((p) => ({ ...p, branchOfficeId: data[0].id }));
          }
        })
        .catch(() => {});
    }
  }, [showNew]);

  // 得意先一覧を取得（インライン現場作成でも得意先を必ず選ばせる＝親→子階層を保持）
  useEffect(() => {
    if (showNew && customers.length === 0) {
      fetch("/api/customers")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setCustomers(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [showNew]);

  const filtered = sites;

  async function handleCreateSite() {
    if (!newSite.siteCode.trim() || !newSite.name.trim()) {
      toast.error("現場コードと現場名は必須です");
      return;
    }
    if (!newSite.branchOfficeId) {
      toast.error("担当営業所を選択してください");
      return;
    }
    if (!newSite.customerId) {
      toast.error("得意先を選択してください");
      return;
    }
    setCreating(true);
    try {
      const body = { ...newSite };
      // Remove empty strings → null for optional fields
      const cleaned = Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, v === "" ? null : v])
      );
      // Keep required fields as-is
      cleaned.siteCode = newSite.siteCode;
      cleaned.name = newSite.name;
      cleaned.branchOfficeId = newSite.branchOfficeId;
      cleaned.status = "active";

      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });
      if (res.ok) {
        const created = await res.json();
        setSites((prev) => [...prev, created]);
        onChange(created.id);
        onSiteCreated?.(created);
        setShowNew(false);
        setNewSite({
          siteCode: "", name: "", customerId: 0, clientName: "", branchOfficeId: branches[0]?.id || 0,
          address: "", contactName1: "", contactTel1: "", contactName2: "", contactTel2: "",
          contactName3: "", contactTel3: "", transportation: "", startDate: "", endDate: "",
          requiredInsurance: "any", notes: "", status: "active",
        });
        toast.success(`現場「${created.name}」を登録しました`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "登録に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setCreating(false);
    }
  }

  if (showNew) {
    return (
      <div className="border rounded-xl p-4 bg-accent/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-primary flex items-center gap-1">
            <Plus className="h-3 w-3" /> 新しい現場を登録
          </span>
          <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 基本情報 */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">基本情報</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">現場コード *</Label>
              <Input value={newSite.siteCode} onChange={(e) => upd("siteCode", e.target.value)} placeholder="S009" className="h-8 text-xs" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">担当営業所 *</Label>
              <select
                className="w-full h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                value={newSite.branchOfficeId}
                onChange={(e) => upd("branchOfficeId", parseInt(e.target.value))}
              >
                {branches.length === 0 && <option value={0}>読込中...</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">現場名 *</Label>
            <Input value={newSite.name} onChange={(e) => upd("name", e.target.value)} placeholder="現場名" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">得意先 *</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
              value={newSite.customerId}
              onChange={(e) => upd("customerId", parseInt(e.target.value))}
            >
              <option value={0}>得意先を選択...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">住所</Label>
            <Input value={newSite.address} onChange={(e) => upd("address", e.target.value)} placeholder="大阪府..." className="h-8 text-xs" />
          </div>
        </div>

        {/* 期間・交通 */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">期間・交通</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">開始日</Label>
              <Input type="date" value={newSite.startDate} onChange={(e) => upd("startDate", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">終了日</Label>
              <Input type="date" value={newSite.endDate} onChange={(e) => upd("endDate", e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">交通手段</Label>
            <Input value={newSite.transportation} onChange={(e) => upd("transportation", e.target.value)} placeholder="車、電車等" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">必要保険種別</Label>
            <select
              className="w-full h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
              value={newSite.requiredInsurance}
              onChange={(e) => upd("requiredInsurance", e.target.value)}
            >
              {INSURANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 連絡先 */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">連絡先</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">先方担当者名1</Label>
              <Input value={newSite.contactName1} onChange={(e) => upd("contactName1", e.target.value)} placeholder="氏名" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">TEL1</Label>
              <Input value={newSite.contactTel1} onChange={(e) => upd("contactTel1", e.target.value)} placeholder="06-xxxx-xxxx" className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">先方担当者名2</Label>
              <Input value={newSite.contactName2} onChange={(e) => upd("contactName2", e.target.value)} placeholder="氏名" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">TEL2</Label>
              <Input value={newSite.contactTel2} onChange={(e) => upd("contactTel2", e.target.value)} placeholder="06-xxxx-xxxx" className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">先方担当者名3</Label>
              <Input value={newSite.contactName3} onChange={(e) => upd("contactName3", e.target.value)} placeholder="氏名" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">TEL3</Label>
              <Input value={newSite.contactTel3} onChange={(e) => upd("contactTel3", e.target.value)} placeholder="06-xxxx-xxxx" className="h-8 text-xs" />
            </div>
          </div>
        </div>

        {/* 備考 */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">備考</Label>
          <Textarea value={newSite.notes} onChange={(e) => upd("notes", e.target.value)} rows={2} className="text-xs" placeholder="特記事項など" />
        </div>

        <Button size="sm" className="w-full h-8 text-xs" onClick={handleCreateSite} disabled={creating}>
          <Check className="h-3 w-3 mr-1" />
          {creating ? "登録中..." : "登録して選択"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <select
        ref={selectRef}
        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
      >
        <option value={0}>現場を選択...</option>
        {filtered.map((s) => (
          <option key={s.id} value={s.id}>
            [{s.siteCode}] {s.name}{s.clientName ? ` (${s.clientName})` : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => setShowNew(true)}
        className="text-[11px] text-primary hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
        新しい現場を登録
      </button>
    </div>
  );
}
