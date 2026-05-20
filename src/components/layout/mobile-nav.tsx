"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Building2,
  FileText,
  MoreHorizontal,
  Download,
  Printer,
  LogOut,
  Truck,
  Briefcase,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const allBottomNavItems = [
  { href: "/calendar", label: "カレンダー", icon: Calendar, staffVisible: true, officeHidden: false },
  { href: "/staff", label: "スタッフ", icon: Users, staffVisible: false, officeHidden: false },
  { href: "/sites", label: "現場", icon: Building2, staffVisible: false, officeHidden: false },
  { href: "/forms", label: "出来高", icon: FileText, staffVisible: true, officeHidden: true },
];

const moreMenuItems = [
  { href: "/customers", label: "得意先", icon: Briefcase, officeHidden: false, adminOnly: false },
  { href: "/vehicles", label: "車両管理", icon: Truck, officeHidden: false, adminOnly: false },
  { href: "/print/work-report", label: "作業日報", icon: Printer, officeHidden: false, adminOnly: false },
  { href: "/print/breakdown", label: "分解表", icon: Printer, officeHidden: true, adminOnly: false },
  { href: "/export", label: "CSV出力", icon: Download, officeHidden: true, adminOnly: false },
  { href: "/settings", label: "設定", icon: Settings, officeHidden: false, adminOnly: true },
];

export function MobileNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  // SSR と CSR で usePathname の値が食い違うことがあり、aria-current や
  // active 表示の有無で hydration mismatch が出る。
  // モバイルナビ自体は md:hidden で PC では非表示なので、マウント完了まで
  // 描画を遅延させても実害が無く、確実に mismatch を避けられる。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    setMoreOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isStaff = userRole === "staff";
  const isOffice = userRole === "office";
  const bottomNavItems = allBottomNavItems.filter((item) => {
    if (isStaff) return item.staffVisible;
    if (isOffice && item.officeHidden) return false;
    return true;
  });
  const filteredMoreMenuItems = moreMenuItems.filter((item) => {
    if (item.adminOnly && userRole !== "admin") return false;
    if (isOffice && item.officeHidden) return false;
    return true;
  });

  const isMoreActive =
    !isStaff &&
    filteredMoreMenuItems.some((item) => pathname.startsWith(item.href));

  // マウント完了前は何も描画しない（hydration mismatch 回避）
  if (!mounted) return null;

  return (
    <>
      {/* Top bar - simple title only */}
      <header className="md:hidden flex items-center h-14 px-4 border-b bg-sidebar text-sidebar-foreground fixed top-0 left-0 right-0 z-50">
        <div className="leading-none">
          <span className="font-bold text-base">スタッフ配置</span>
          <span className="text-xs text-sidebar-foreground/60 ml-2">管理システム</span>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50 safe-area-inset-bottom shadow-[0_-1px_4px_rgba(0,0,0,0.04)]"
        aria-label="メインメニュー"
      >
        <div className="flex items-stretch justify-around h-[72px]">
          {bottomNavItems.map((item) => {
            const isActive =
              item.href === "/calendar"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 flex-1 pt-2 pb-1.5 text-xs transition-colors",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-primary"
                  />
                )}
                <item.icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    isActive && "text-primary",
                  )}
                />
                <span className="leading-tight">{item.label}</span>
              </Link>
            );
          })}

          {/* More menu */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              aria-label="その他のメニュー"
              aria-current={isMoreActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 pt-2 pb-1.5 text-xs transition-colors",
                isMoreActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {isMoreActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-b-full bg-primary"
                />
              )}
              <MoreHorizontal
                className={cn(
                  "h-6 w-6 transition-colors",
                  isMoreActive && "text-primary",
                )}
              />
              <span className="leading-tight">その他</span>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-8">
              <SheetTitle className="px-5 pb-2 text-lg font-bold">メニュー</SheetTitle>
              <nav className="flex flex-col" aria-label="追加メニュー">
                {!isStaff && filteredMoreMenuItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-5 py-4 text-base font-medium transition-colors",
                        isActive
                          ? "text-primary bg-primary/5 font-semibold"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      <item.icon className="h-6 w-6" />
                      {item.label}
                    </Link>
                  );
                })}
                {!isStaff && <div className="border-t my-1" />}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-5 py-4 text-base font-medium text-muted-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  <LogOut className="h-6 w-6" />
                  ログアウト
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}
