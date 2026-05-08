"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Building2,
  FileText,
  Download,
  LogOut,
  Printer,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ScrollText,
  MonitorPlay,
  Truck,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  Calendar,
  Users,
  Building2,
  FileText,
  Download,
  Printer,
  ShieldCheck,
  ScrollText,
  MonitorPlay,
  Truck,
  Receipt,
} as const;

const allNavItems = [
  { href: "/calendar", label: "カレンダー", icon: "Calendar" as const, staffVisible: true, adminOnly: false },
  { href: "/staff", label: "スタッフ", icon: "Users" as const, staffVisible: false, adminOnly: false },
  { href: "/sites", label: "現場", icon: "Building2" as const, staffVisible: false, adminOnly: false },
  { href: "/vehicles", label: "車両管理", icon: "Truck" as const, staffVisible: false, adminOnly: false },
  { href: "/forms", label: "出来高確認書", icon: "FileText" as const, staffVisible: true, adminOnly: false },
  { href: "/tally", label: "日計表", icon: "Receipt" as const, staffVisible: false, adminOnly: false },
  { href: "/export", label: "CSV出力", icon: "Download" as const, staffVisible: false, adminOnly: false },
  { href: "/print/daily", label: "印刷", icon: "Printer" as const, staffVisible: false, adminOnly: false },
  { href: "/signage", label: "サイネージ", icon: "MonitorPlay" as const, staffVisible: false, adminOnly: false, external: true },
  { href: "/users", label: "ユーザー管理", icon: "ShieldCheck" as const, staffVisible: false, adminOnly: true },
  { href: "/audit-logs", label: "監査ログ", icon: "ScrollText" as const, staffVisible: false, adminOnly: true },
];

export function Sidebar({
  collapsed,
  onToggle,
  userRole,
}: {
  collapsed: boolean;
  onToggle: () => void;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 z-30",
        collapsed ? "md:w-20" : "md:w-64",
      )}
      aria-label="メインメニュー"
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-sidebar-border",
            collapsed ? "justify-center px-2" : "justify-between px-5",
          )}
        >
          {!collapsed && (
            <Link href="/calendar" className="leading-none">
              <div className="font-bold text-base text-sidebar-foreground">
                マツケン
              </div>
              <div className="text-[11px] text-sidebar-foreground/60 mt-0.5">
                配置管理システム
              </div>
            </Link>
          )}
          <button
            onClick={onToggle}
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
            title={collapsed ? "メニューを開く" : "メニューを閉じる"}
            aria-label={collapsed ? "メニューを開く" : "メニューを閉じる"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav
          className={cn("flex-1 py-4 space-y-1", collapsed ? "px-2" : "px-3")}
        >
          {allNavItems
            .filter((item) => {
              if (userRole === "staff") return item.staffVisible;
              if (item.adminOnly) return userRole === "admin";
              return true;
            })
            .map((item) => {
              const Icon = iconMap[item.icon];
              const isActive =
                item.href === "/calendar"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={"external" in item && item.external ? "_blank" : undefined}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "group flex items-center rounded-lg font-medium transition-all relative",
                    collapsed
                      ? "h-12 w-12 justify-center mx-auto"
                      : "h-12 gap-3 px-4 text-[15px]",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {isActive && !collapsed && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                    />
                  )}
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              );
            })}
        </nav>

        {/* Bottom */}
        <div
          className={cn(
            "py-3 border-t border-sidebar-border",
            collapsed ? "px-2" : "px-3",
          )}
        >
          <button
            onClick={handleLogout}
            title={collapsed ? "ログアウト" : undefined}
            aria-label="ログアウト"
            className={cn(
              "flex items-center rounded-lg font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full",
              collapsed
                ? "h-12 w-12 justify-center mx-auto"
                : "h-12 gap-3 px-4 text-[15px]",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && "ログアウト"}
          </button>
        </div>
      </div>
    </aside>
  );
}
