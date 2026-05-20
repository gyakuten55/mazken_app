import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <p className="text-6xl font-bold text-primary">404</p>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            ページが見つかりませんでした
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            アクセスされたページは存在しないか、移動された可能性があります。
            URL を確認するか、下のリンクから戻ってください。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/calendar"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            カレンダーへ戻る
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-input px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            ログイン画面へ
          </Link>
        </div>
      </div>
    </div>
  );
}
