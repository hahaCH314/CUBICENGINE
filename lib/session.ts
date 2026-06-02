import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface SessionPayload {
  sub: string;
  username: string;
  email: string;
}

const COOKIE_NAME = "mmc-session";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/* ─── Auto-generate JWT secret if JWT_SECRET is not set ─── */

function getJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const keyFile = path.join(process.cwd(), "data", ".jwt-secret");
  const dataDir = path.dirname(keyFile);

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, "utf8").trim();
  }

  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(keyFile, secret, { mode: 0o600 });
  console.log("🔑 JWT シークレットを自動生成しました → data/.jwt-secret");
  return secret;
}

function encodedKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

/* ─── JWT helpers ─── */

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/* ─── Cookie session ─── */

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encrypt(payload);
  const expires = new Date(Date.now() + SEVEN_DAYS_MS);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decrypt(store.get(COOKIE_NAME)?.value);
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
