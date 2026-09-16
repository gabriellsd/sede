import { cookies } from "next/headers";
import { ensureStore, userFromToken } from "./store";

export const COOKIE = "sede_session";

export async function getCurrentUser() {
  await ensureStore();
  const jar = await cookies();
  return userFromToken(jar.get(COOKIE)?.value);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.SEDE_SECURE_COOKIES === "true",
  };
}
