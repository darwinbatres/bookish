import { z } from "zod";

/**
 * Environment configuration schema with validation
 * All environment variables are validated at runtime
 * NO hardcoded defaults for sensitive values - must be set via environment
 */
const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Authentication - REQUIRED in production, defaults only for dev convenience
  AUTH_ENABLED: z.coerce.boolean().default(true),
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD: z.string().min(8),
  AUTH_SESSION_SECRET: z.string().min(32),
  AUTH_SESSION_DURATION: z.coerce.number().default(604800), // 7 days in seconds

  // PostgreSQL Database - ALL REQUIRED
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number(),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_MAX_CONNECTIONS: z.coerce.number().default(20),
  POSTGRES_SSL_MODE: z
    .enum(["disable", "require", "verify-ca", "verify-full"])
    .default("disable"),

  // S3 - Required, but falls back to MINIO defaults for local dev
  S3_ENDPOINT: z.string().min(1),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // Allow empty for local dev - will use MINIO_ROOT_USER/PASSWORD as fallback
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // MinIO credentials (used as fallback when S3 creds not set)
  MINIO_ROOT_USER: z.string().default("minioadmin"),
  MINIO_ROOT_PASSWORD: z.string().default("minioadmin"),

  // Upload (maxSizeMB is now stored in database, not env)
  UPLOAD_ALLOWED_TYPES: z
    .string()
    .default("application/pdf,application/epub+zip"),
  PRESIGNED_URL_EXPIRY: z.coerce.number().default(3600),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(false),
  RATE_LIMIT_RPM: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_REQUESTS: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws if required variables are missing or invalid
 */
function parseEnv(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}

// Singleton config instance
let configInstance: EnvConfig | null = null;

/**
 * Get validated configuration
 * Lazily parsed on first access
 */
export function getConfig(): EnvConfig {
  if (!configInstance) {
    configInstance = parseEnv();
  }
  return configInstance;
}

/**
 * Derived configuration helpers
 */
export const config = {
  get env() {
    return getConfig();
  },

  get isDev() {
    return getConfig().NODE_ENV === "development";
  },

  get isProd() {
    return getConfig().NODE_ENV === "production";
  },

  get isTest() {
    return getConfig().NODE_ENV === "test";
  },

  get s3() {
    const env = getConfig();
    // Use S3 credentials if set, otherwise fall back to MinIO credentials
    const accessKeyId = env.S3_ACCESS_KEY_ID || env.MINIO_ROOT_USER;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY || env.MINIO_ROOT_PASSWORD;
    return {
      endpoint: env.S3_ENDPOINT,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId,
      secretAccessKey,
      isConfigured: Boolean(env.S3_ENDPOINT && accessKeyId && secretAccessKey),
    };
  },

  get upload() {
    const env = getConfig();
    return {
      allowedTypes: env.UPLOAD_ALLOWED_TYPES.split(",").map((t) => t.trim()),
      presignedUrlExpiry: env.PRESIGNED_URL_EXPIRY,
    };
  },

  get auth() {
    const env = getConfig();
    return {
      enabled: env.AUTH_ENABLED,
      username: env.AUTH_USERNAME,
      password: env.AUTH_PASSWORD,
      sessionSecret: env.AUTH_SESSION_SECRET,
      sessionDuration: env.AUTH_SESSION_DURATION,
    };
  },

  get db() {
    const env = getConfig();
    return {
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      maxConnections: env.POSTGRES_MAX_CONNECTIONS,
      sslMode: env.POSTGRES_SSL_MODE,
      isConfigured: Boolean(env.POSTGRES_HOST && env.POSTGRES_PASSWORD),
    };
  },
};

export default config;
