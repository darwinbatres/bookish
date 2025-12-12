import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config";

const encoder = new TextEncoder();

/**
 * Get the secret key for JWT signing
 */
function getSecretKey() {
  return encoder.encode(config.auth.sessionSecret);
}

/**
 * Session payload structure
 */
export interface SessionPayload {
  username: string;
  iat: number;
  exp: number;
}

/**
 * Create a new session token
 */
export async function createSession(username: string): Promise<string> {
  const secretKey = getSecretKey();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + config.auth.sessionDuration;

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secretKey);

  return token;
}

/**
 * Verify and decode a session token
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Validate login credentials
 */
export function validateCredentials(
  username: string,
  password: string
): boolean {
  return username === config.auth.username && password === config.auth.password;
}

/**
 * Cookie name for session token
 */
export const SESSION_COOKIE_NAME = "bookish_session";

/**
 * Get cookie options for session
 */
export function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}
