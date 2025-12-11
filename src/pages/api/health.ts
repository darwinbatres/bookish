import type { NextApiRequest, NextApiResponse } from "next";
import { checkDatabaseHealth } from "@/lib/db";
import { checkS3Health, isS3Configured } from "@/lib/s3";

interface ServiceStatus {
  status: "ok" | "error" | "not_configured";
  latencyMs?: number;
}

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    storage: ServiceStatus;
  };
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  const startTime = Date.now();

  // Check database health
  let dbStatus: ServiceStatus;
  try {
    const dbHealthy = await checkDatabaseHealth();
    dbStatus = {
      status: dbHealthy ? "ok" : "error",
      latencyMs: Date.now() - startTime,
    };
  } catch {
    dbStatus = {
      status: "error",
      latencyMs: Date.now() - startTime,
    };
  }

  // Check S3 health
  const s3StartTime = Date.now();
  let s3Status: ServiceStatus;
  if (!isS3Configured()) {
    s3Status = { status: "not_configured" };
  } else {
    try {
      const s3Healthy = await checkS3Health();
      s3Status = {
        status: s3Healthy ? "ok" : "error",
        latencyMs: Date.now() - s3StartTime,
      };
    } catch {
      s3Status = {
        status: "error",
        latencyMs: Date.now() - s3StartTime,
      };
    }
  }

  // Determine overall status
  const dbOk = dbStatus.status === "ok";
  const s3Ok = s3Status.status === "ok" || s3Status.status === "not_configured";
  const overallStatus =
    dbOk && s3Ok ? "ok" : dbOk || s3Ok ? "degraded" : "error";

  res.status(overallStatus === "ok" ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbStatus,
      storage: s3Status,
    },
  });
}
