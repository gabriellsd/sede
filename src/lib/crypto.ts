import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashed = scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, "hex");
  if (hashed.length !== actual.length) return false;
  return timingSafeEqual(hashed, actual);
}

export function randomId(bytes = 16) {
  return randomBytes(bytes).toString("hex");
}
