import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import {
  validateCredentials,
  createSession,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from "@/lib/auth";
import { config } from "@/lib/config";

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // If auth is disabled, auto-login
  if (!config.auth.enabled) {
    return res.status(200).json({ success: true });
  }

  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Validate credentials
    if (!validateCredentials(username, password)) {
      // Add delay to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Create session token
    const token = await createSession(username);

    // Set cookie
    const cookieOptions = getSessionCookieOptions(config.auth.sessionDuration);
    res.setHeader(
      "Set-Cookie",
      serialize(SESSION_COOKIE_NAME, token, cookieOptions)
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
