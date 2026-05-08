"use client";

import { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

interface UserSession {
  role: string;
  staffId?: number;
  name: string;
}

const SidebarContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
}>({ collapsed: false, toggle: () => {} });

const UserSessionContext = createContext<UserSession>({
  role: "viewer",
  name: "",
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function useUserSession() {
  return useContext(UserSessionContext);
}

export function DashboardShell({
  children,
  userRole,
  staffId,
  userName,
}: {
  children: React.ReactNode;
  userRole: string;
  staffId?: number;
  userName: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const userSession: UserSession = { role: userRole, staffId, name: userName };

  return (
    <UserSessionContext.Provider value={userSession}>
      <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
        <div className="min-h-screen">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} userRole={userRole} />
          <MobileNav userRole={userRole} />
          <main
            className={cn(
              "pt-14 md:pt-0 pb-24 md:pb-0 min-h-screen transition-[padding] duration-200",
              collapsed ? "md:pl-20" : "md:pl-64"
            )}
          >
            {children}
          </main>
        </div>
      </SidebarContext.Provider>
    </UserSessionContext.Provider>
  );
}
