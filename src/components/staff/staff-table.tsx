"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { INSURANCE_TYPES } from "@/lib/constants";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type StaffWithRelations = {
  id: number;
  employeeCode: string;
  name: string;
  nameKana: string;
  phone: string | null;
  insuranceType: string;
  branchOffice: { id: number; name: string; code: string; color: string };
  staffQualifications: {
    qualification: { id: number; name: string };
  }[];
};

type BranchOffice = { id: number; name: string; code: string; color: string };
type Qualification = { id: number; name: string };

export function StaffTable({
  staff,
  branchOffices,
  qualifications: _qualifications,
  readOnly = false,
}: {
  staff: StaffWithRelations[];
  branchOffices: BranchOffice[];
  qualifications: Qualification[];
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<number | null>(null);

  const filtered = staff.filter((s) => {
    if (branchFilter && s.branchOffice.id !== branchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.nameKana.toLowerCase().includes(q) ||
        s.employeeCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前・コードで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={branchFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setBranchFilter(null)}
          >
            全て
          </Button>
          {branchOffices.map((bo) => (
            <Button
              key={bo.id}
              variant={branchFilter === bo.id ? "default" : "outline"}
              size="sm"
              onClick={() => setBranchFilter(bo.id)}
              style={
                branchFilter === bo.id
                  ? { backgroundColor: bo.color, borderColor: bo.color }
                  : {}
              }
            >
              {bo.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">{filtered.length} 名表示中</p>

      {/* Table */}
      <div className="rounded-xl border shadow-sm bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">コード</TableHead>
              <TableHead>氏名</TableHead>
              <TableHead className="hidden md:table-cell">営業所</TableHead>
              <TableHead className="hidden md:table-cell">保険</TableHead>
              <TableHead className="hidden lg:table-cell">資格</TableHead>
              <TableHead className="hidden md:table-cell">電話</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.employeeCode}</TableCell>
                <TableCell>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {s.nameKana}
                    </span>
                  </div>
                  <div className="md:hidden mt-1 flex gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      style={{ borderColor: s.branchOffice.color, color: s.branchOffice.color }}
                    >
                      {s.branchOffice.name}
                    </Badge>
                    <Badge variant="secondary">
                      {INSURANCE_TYPES[s.insuranceType as keyof typeof INSURANCE_TYPES]}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant="outline"
                    style={{ borderColor: s.branchOffice.color, color: s.branchOffice.color }}
                  >
                    {s.branchOffice.name}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="secondary">
                    {INSURANCE_TYPES[s.insuranceType as keyof typeof INSURANCE_TYPES]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {s.staffQualifications.slice(0, 3).map((sq) => (
                      <Badge key={sq.qualification.id} variant="outline" className="text-xs">
                        {sq.qualification.name.length > 6
                          ? sq.qualification.name.slice(0, 6) + "..."
                          : sq.qualification.name}
                      </Badge>
                    ))}
                    {s.staffQualifications.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{s.staffQualifications.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {s.phone}
                </TableCell>
                <TableCell>
                  <Link href={`/staff/${s.id}`}>
                    <Button variant="outline" size="sm">{readOnly ? "詳細" : "編集"}</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
