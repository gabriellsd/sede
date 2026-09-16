import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, cookieOptions } from "@/lib/auth";
import { getHub } from "@/lib/hub";
import { deleteSession, ensureStore, userFromToken } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  await ensureStore();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const user = userFromToken(token);
  if (token) await deleteSession(token);
  if (user) {
    getHub();
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
