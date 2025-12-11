import type { NextApiRequest, NextApiResponse } from "next";
import { parse } from "cookie";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { config } from "@/lib/config";

interface MeResponse {
  authenticated: boolean;
  username?: string;
  authEnabled: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MeResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      authenticated: false,
      authEnabled: config.auth.enabled,
    });
  }

  // If auth is disabled, always authenticated
  if (!config.auth.enabled) {
    return res.status(200).json({
      authenticated: true,
      username: "guest",
      authEnabled: false,
    });
  }

  try {
    const cookies = parse(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE_NAME];

    if (!token) {
      return res.status(200).json({
        authenticated: false,
        authEnabled: true,
      });
    }

    const session = await verifySession(token);

    if (!session) {
      return res.status(200).json({
        authenticated: false,
        authEnabled: true,
      });
    }

    return res.status(200).json({
      authenticated: true,
      username: session.username,
      authEnabled: true,
    });
  } catch (error) {
    console.error("[Auth] Session verification error:", error);
    return res.status(200).json({
      authenticated: false,
      authEnabled: true,
    });
  }
}
