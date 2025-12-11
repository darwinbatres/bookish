import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { Errors, sendError } from "./errors";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

interface MethodHandlers {
  GET?: NextApiHandler;
  POST?: NextApiHandler;
  PUT?: NextApiHandler;
  PATCH?: NextApiHandler;
  DELETE?: NextApiHandler;
  OPTIONS?: NextApiHandler;
}

/**
 * Create a handler that routes to different handlers based on HTTP method
 */
export function withMethods(handlers: MethodHandlers): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = req.method as HttpMethod;
    const handler = handlers[method as keyof MethodHandlers];

    if (!handler) {
      const allowed = Object.keys(handlers);
      res.setHeader("Allow", allowed.join(", "));
      return sendError(res, Errors.methodNotAllowed(allowed));
    }

    return handler(req, res);
  };
}

/**
 * Wrap handler with error catching
 */
export function withErrorHandler(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Compose multiple middleware functions
 */
export function compose(
  ...middlewares: ((handler: NextApiHandler) => NextApiHandler)[]
): (handler: NextApiHandler) => NextApiHandler {
  return (handler: NextApiHandler) =>
    middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
}

export function withRateLimit(
  options: RateLimitOptions = {}
): (handler: NextApiHandler) => NextApiHandler {
  const { windowMs = 60000, max = 100 } = options;

  return (handler: NextApiHandler) =>
    async (req: NextApiRequest, res: NextApiResponse) => {
      const ip = getClientIp(req);
      const now = Date.now();
      const record = rateLimitStore.get(ip);

      if (record && now < record.resetTime) {
        if (record.count >= max) {
          const retryAfter = Math.ceil((record.resetTime - now) / 1000);
          res.setHeader("Retry-After", retryAfter.toString());
          res.setHeader("X-RateLimit-Limit", max.toString());
          res.setHeader("X-RateLimit-Remaining", "0");
          return sendError(res, Errors.tooManyRequests(retryAfter));
        }
        record.count++;
      } else {
        rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      }

      const current = rateLimitStore.get(ip)!;
      res.setHeader("X-RateLimit-Limit", max.toString());
      res.setHeader("X-RateLimit-Remaining", (max - current.count).toString());

      return handler(req, res);
    };
}

/**
 * Get client IP from request
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * Require specific content type
 */
export function withContentType(
  contentType: string
): (handler: NextApiHandler) => NextApiHandler {
  return (handler: NextApiHandler) =>
    async (req: NextApiRequest, res: NextApiResponse) => {
      if (req.method !== "GET" && req.method !== "DELETE") {
        const reqContentType = req.headers["content-type"];
        if (!reqContentType?.includes(contentType)) {
          return sendError(
            res,
            Errors.badRequest(`Content-Type must be ${contentType}`)
          );
        }
      }
      return handler(req, res);
    };
}

/**
 * CORS middleware
 */
interface CorsOptions {
  origin?: string | string[];
  methods?: HttpMethod[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

export function withCors(
  options: CorsOptions = {}
): (handler: NextApiHandler) => NextApiHandler {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    credentials = false,
  } = options;

  return (handler: NextApiHandler) =>
    async (req: NextApiRequest, res: NextApiResponse) => {
      const originHeader =
        typeof origin === "string" ? origin : origin.join(",");

      res.setHeader("Access-Control-Allow-Origin", originHeader);
      res.setHeader("Access-Control-Allow-Methods", methods.join(","));
      res.setHeader("Access-Control-Allow-Headers", allowedHeaders.join(","));

      if (credentials) {
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }

      // Handle preflight
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      return handler(req, res);
    };
}
