"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, QrCode, LogIn, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/calendar");
        router.refresh();
      } else {
        setError("ユーザー名またはパスワードが正しくありません");
      }
    } catch {
      setError("ログインに失敗しました。通信を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left: Brand panel */}
      <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden bg-[oklch(0.45_0.12_250)]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-white/20" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/10" />
        </div>
        <div className="relative z-10 text-center px-8">
          <h1 className="text-white text-4xl font-bold tracking-tight">
            スタッフ配置
          </h1>
          <p className="text-white/80 text-xl mt-3">管理システム</p>
          <div className="mt-10 text-white/50 text-base max-w-xs mx-auto leading-relaxed">
            スタッフの配置・現場管理を
            <br />
            シンプルに、確実に。
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex items-center justify-center px-6 py-10 md:p-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile title */}
          <div className="md:hidden text-center">
            <h1 className="font-bold text-2xl">スタッフ配置管理システム</h1>
            <p className="text-base text-muted-foreground mt-1">
              ログイン
            </p>
          </div>

          <div className="hidden md:block">
            <h2 className="text-2xl font-bold tracking-tight">ログイン</h2>
            <p className="text-base text-muted-foreground mt-1">
              ユーザー名とパスワードを入力してください
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base">
                ユーザー名
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例: admin"
                autoComplete="username"
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">
                パスワード
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  autoComplete="current-password"
                  className="h-12 text-base pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 text-[15px] text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-3"
              >
                <TriangleAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}
            <Button
              type="submit"
              size="xl"
              className="w-full"
              disabled={loading}
            >
              <LogIn className="h-5 w-5" />
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-sm text-muted-foreground">
                または
              </span>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-base font-semibold">
              <QrCode className="h-5 w-5" />
              QRコードでログイン
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              スマホで専用QRコードを読み取ると
              <br />
              自動でログインできます。
            </p>
            <p className="text-xs text-muted-foreground">
              QRコードは管理者から配布されます
            </p>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm">
            <p className="font-semibold text-foreground mb-1">デモアカウント</p>
            <div className="text-muted-foreground space-y-0.5">
              <p>
                ユーザー名:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">
                  admin
                </code>
              </p>
              <p>
                パスワード:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">
                  demo1234
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
