import { type SessionOptions } from "iron-session";

export interface SessionData {
  userId: number;
}

export const sessionOptions: SessionOptions = {
  cookieName: "matsken_session",
  password: process.env.SESSION_SECRET || "this-is-a-development-only-secret-key-min-32-chars",
  ttl: 60 * 60 * 24 * 7, // 1 week
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  },
};
