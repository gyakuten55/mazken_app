import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { parseId } from "@/lib/validations";

// GET: 書類の実体を Content-Type 付きで配信（<img src> や別タブ表示に使う）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id, docId } = await params;
  const staffId = parseId(id);
  const documentId = parseId(docId);
  if (!staffId || !documentId) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  const doc = await prisma.staffDocument.findUnique({
    where: { id: documentId },
    select: { data: true, mimeType: true, name: true, staffId: true },
  });
  if (!doc || doc.staffId !== staffId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = Buffer.from(doc.data as Uint8Array);
  // 日本語ファイル名は filename* に URL エンコードして渡す
  const encodedName = encodeURIComponent(doc.name);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=60",
      // セキュリティ: MIME スニッフ無効化＋サンドボックスで、万一の能動コンテンツも実行させない
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox; style-src 'unsafe-inline'",
    },
  });
}

// DELETE: 書類削除（admin のみ）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id, docId } = await params;
  const staffId = parseId(id);
  const documentId = parseId(docId);
  if (!staffId || !documentId) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  const doc = await prisma.staffDocument.findUnique({
    where: { id: documentId },
    select: { staffId: true },
  });
  if (!doc || doc.staffId !== staffId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.staffDocument.delete({ where: { id: documentId } });
  return NextResponse.json({ ok: true });
}
