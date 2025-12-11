import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { config } from "@/lib/config";

/**
 * Extended request type with user information
 */
interface AuthenticatedRequest extends NextApiRequest {
  user?: { username: string };
}

/**
 * Middleware to protect API routes with authentication
 * Skips auth check if AUTH_ENABLED=false
 */
export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip auth if disabled
    if (!config.auth.enabled) {
      return handler(req, res);
    }

    // Get session token from cookie
    const token = req.cookies[SESSION_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    // Verify the token
    const session = await verifySession(token);

    if (!session) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired session",
      });
    }

    // Attach user info to request for downstream use
    (req as AuthenticatedRequest).user = { username: session.username };

    return handler(req, res);
  };
}

/**
 * Get the current user from request (after withAuth middleware)
 */
export function getRequestUser(
  req: NextApiRequest
): { username: string } | null {
  return (req as AuthenticatedRequest).user || null;
}
