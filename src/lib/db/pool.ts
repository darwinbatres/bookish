import { Pool, PoolConfig } from "pg";
import { config } from "@/lib/config";

/**
 * PostgreSQL connection pool singleton
 * Uses centralized config for configuration
 */

let pool: Pool | null = null;

function getPoolConfig(): PoolConfig {
  const dbConfig = config.db;

  return {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    // Connection pool settings
    max: dbConfig.maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // SSL for production
    ssl:
      config.isProd && dbConfig.sslMode !== "disable"
        ? { rejectUnauthorized: dbConfig.sslMode === "verify-full" }
        : undefined,
  };
}

/**
 * Get the database connection pool (singleton)
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());

    // Log connection errors
    pool.on("error", (err) => {
      console.error("[DB] Unexpected error on idle client:", err);
    });

    // Log when pool connects
    pool.on("connect", () => {
      if (config.isDev) {
        console.log("[DB] New client connected to pool");
      }
    });
  }

  return pool;
}

/**
 * Close the connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[DB] Connection pool closed");
  }
}

/**
 * Health check - test database connectivity
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[DB] Health check failed:", error);
    return false;
  }
}

export default getPool;
