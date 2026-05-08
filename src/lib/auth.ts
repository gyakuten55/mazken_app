import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "./prisma";
import { compareSync } from "bcryptjs";
import { type SessionData, sessionOptions } from "./session";
import { setAuditActor } from "./audit-context";

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { branchOffice: true },
  });

  if (!user || !user.isActive) return null;
  if (!compareSync(password, user.passwordHash)) return null;

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = user.id;
  await session.save();

  setAuditActor({ userId: user.id, username: user.username });

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    staffId: user.staffId,
    branchOffice: user.branchOffice,
  };
}

export async function loginByToken(token: string) {
  if (!token) return null;
  const user = await prisma.user.findUnique({
    where: { loginToken: token },
    include: { branchOffice: true },
  });

  if (!user || !user.isActive) return null;

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = user.id;
  await session.save();

  setAuditActor({ userId: user.id, username: user.username });

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    staffId: user.staffId,
    branchOffice: user.branchOffice,
  };
}

export async function logout() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
}

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { branchOffice: true },
    });
    if (!user || !user.isActive) return null;

    setAuditActor({ userId: user.id, username: user.username });

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      staffId: user.staffId,
      branchOffice: user.branchOffice,
    };
  } catch {
    return null;
  }
}
