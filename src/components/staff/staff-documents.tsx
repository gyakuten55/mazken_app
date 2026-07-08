"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

type DocMeta = {
  id: number;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const MAX_SIZE = 4 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function StaffDocuments({
  staffId,
  canEdit,
}: {
  staffId: number;
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/staff/${staffId}/documents`);
      if (!res.ok) throw new Error();
      setDocs(await res.json());
    } catch {
      toast.error("書類の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error("ファイルは 4MB までです");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];
    if (file.type && !allowed.includes(file.type)) {
      toast.error("PNG / JPEG / GIF / WebP / PDF のみアップロードできます");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name);
      const res = await fetch(`/api/staff/${staffId}/documents`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "アップロードに失敗しました");
      }
      toast.success("書類をアップロードしました");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(doc: DocMeta) {
    if (!confirm(`「${doc.name}」を削除しますか？`)) return;
    try {
      const res = await fetch(`/api/staff/${staffId}/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("書類を削除しました");
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">登録された書類はありません。</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docs.map((doc) => {
            const src = `/api/staff/${staffId}/documents/${doc.id}`;
            const isImage = doc.mimeType.startsWith("image/");
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border p-2.5"
              >
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  title="別タブで表示"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={doc.name}
                      className="h-14 w-14 rounded object-cover border bg-muted"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded border bg-muted flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{doc.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {doc.mimeType.startsWith("image/") ? "画像" : "PDF"} · {formatSize(doc.size)}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <a
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      <ExternalLink className="h-3 w-3" /> 表示
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Trash2 className="h-3 w-3" /> 削除
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> アップロード中…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> 書類を追加（画像 / PDF・4MBまで）
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
