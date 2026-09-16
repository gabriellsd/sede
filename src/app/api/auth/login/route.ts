import { NextResponse } from "next/server";
import { COOKIE, cookieOptions } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { createSession, ensureStore, findUserByEmail } from "@/lib/store";
import { toPublicUser } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureStore();
  const body = (await request.json()) as { email?: string; password?: string };
  const user = findUserByEmail(body.email ?? "");
  if (!user || !verifyPassword(body.password ?? "", user.passwordHash)) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(COOKIE, token, cookieOptions());
  return response;
}
