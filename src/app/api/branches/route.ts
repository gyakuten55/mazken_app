import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const branches = await prisma.branchOffice.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(branches);
}
