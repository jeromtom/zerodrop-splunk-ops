import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "./db";

const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
const COOKIE = "zd_session";

// ---------- passwords (scrypt, no external deps) ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------- HMAC-signed session cookie ----------

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function makeSessionToken(email: string): string {
  const payload = Buffer.from(email, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, "base64url").toString("utf8");
}

export async function getSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  return parseSessionToken(jar.get(COOKIE)?.value);
}

export function sessionCookie(email: string) {
  return {
    name: COOKIE,
    value: makeSessionToken(email),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}

export function clearedSessionCookie() {
  return { ...sessionCookie(""), value: "", maxAge: 0 };
}

// ---------- brand users (single-table: USER#<email> / PROFILE) ----------

export interface BrandUser {
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
}

export async function getUser(email: string): Promise<BrandUser | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${email.toLowerCase()}`, SK: "PROFILE" },
    })
  );
  return (res.Item as BrandUser | undefined) ?? null;
}

export async function createUser(
  email: string,
  name: string,
  password: string
): Promise<BrandUser> {
  const user: BrandUser = {
    email: email.toLowerCase(),
    name,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${user.email}`,
        SK: "PROFILE",
        type: "USER",
        ...user,
      },
      // First write wins — no silent account takeover.
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return user;
}
