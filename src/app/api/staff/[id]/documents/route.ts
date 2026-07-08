import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isAuthError } from "@/lib/api-auth";
import { parseId } from "@/lib/validations";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB（Vercel のリクエストボディ上限に収める）

// 許可する MIME（SVG は <script> を埋め込めるため除外＝同一オリジンでの保存型 XSS を防ぐ）
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

// マジックバイトで実体を判定し、サーバ側で決めた MIME を返す（client の file.type は信用しない）
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif"; // "GIF8"
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

// GET: そのスタッフの書類一覧（data は含めない・軽量メタデータのみ）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const staffId = parseId(id);
  if (!staffId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const docs = await prisma.staffDocument.findMany({
    where: { staffId },
    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

// POST: 書類アップロード（multipart/form-data: file, name?）。スタッフ編集と同じく admin のみ。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const staffId = parseId(id);
  if (!staffId) return NextResponse.json({ error: "無効なIDです" }, { status: 400 });

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } });
  if (!staff) return NextResponse.json({ error: "スタッフが見つかりません" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "アップロード形式が不正です" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルを選択してください" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "ファイルは 4MB までです" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // client の Content-Type は信用せず、実体（マジックバイト）で判定して許可リストと照合
  const sniffedMime = sniffMime(buf);
  if (!sniffedMime || !ALLOWED_MIME.has(sniffedMime)) {
    return NextResponse.json(
      { error: "対応していないファイル形式です（PNG / JPEG / GIF / WebP / PDF のみ）" },
      { status: 400 },
    );
  }

  const rawName = (form.get("name") as string | null)?.trim();
  const name = rawName || file.name || "書類";

  const doc = await prisma.staffDocument.create({
    // mimeType はサーバが判定した値を保存（spoofing 防止）
    data: { staffId, name, mimeType: sniffedMime, size: buf.length, data: buf },
    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
  });
  return NextResponse.json(doc, { status: 201 });
}
