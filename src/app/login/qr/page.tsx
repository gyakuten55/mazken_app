import { redirect } from "next/navigation";
import { loginByToken } from "@/lib/auth";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function QrLoginPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login");
  }

  const user = await loginByToken(token);
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm w-full text-center space-y-4 rounded-xl border p-8">
          <h1 className="text-xl font-bold text-destructive">ログインに失敗しました</h1>
          <p className="text-sm text-muted-foreground">
            QRコードが無効、または管理者により無効化されています。
            <br />
            管理者に新しいQRコードの発行を依頼してください。
          </p>
          <a
            href="/login"
            className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            通常ログインへ
          </a>
        </div>
      </div>
    );
  }

  if (user.role === "staff") {
    redirect("/signage");
  }
  redirect("/calendar");
}
