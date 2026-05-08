import type { ReactNode } from "react";

export const metadata = {
  title: "マツケン サイネージ",
};

export default function SignageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {children}
    </div>
  );
}
