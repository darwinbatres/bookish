import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";

// S3 Configuration from centralized config
// - S3_ENDPOINT: Internal endpoint for server-side operations (inside Docker network)
// - S3_PUBLIC_ENDPOINT: Public endpoint for browser uploads (presigned PUT URLs)
//
// Downloads are proxied through /api/books/stream (API Gateway pattern), so only
// the server needs to reach S3. Uploads still use presigned URLs, so the browser
// needs to reach S3_PUBLIC_ENDPOINT for upload functionality.
const s3Config = {
  endpoint: config.s3.endpoint,
  publicEndpoint: config.s3.publicEndpoint,
  region: config.s3.region,
  bucket: config.s3.bucket,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
};

// Validate S3 configuration
export function isS3Configured(): boolean {
  return config.s3.isConfigured;
}

// Create S3 client for internal operations (singleton)
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    if (!isS3Configured()) {
      throw new Error(
        "S3 is not configured. Please set the required environment variables."
      );
    }

    s3Client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: s3Config.credentials,
      forcePathStyle: true, // Required for MinIO and DigitalOcean Spaces
    });
  }

  return s3Client;
}

// Create S3 client for public presigned URLs (uses public endpoint)
let s3PublicClient: S3Client | null = null;

function getS3PublicClient(): S3Client {
  if (!s3PublicClient) {
    if (!isS3Configured()) {
      throw new Error(
        "S3 is not configured. Please set the required environment variables."
      );
    }

    s3PublicClient = new S3Client({
      endpoint: s3Config.publicEndpoint,
      region: s3Config.region,
      credentials: s3Config.credentials,
      forcePathStyle: true,
    });
  }

  return s3PublicClient;
}

/**
 * Generate a presigned URL for uploading a file to S3
 * Uses public endpoint so the browser can access it
 */
export async function generateUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = config.upload.presignedUrlExpiry
): Promise<string> {
  const client = getS3PublicClient();

  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Check if a file exists in S3
 */
export async function fileExistsInS3(key: string): Promise<boolean> {
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Generate a unique S3 key for a book file
 */
export function generateBookS3Key(bookId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "pdf";
  const timestamp = Date.now();
  return `books/${bookId}/${timestamp}.${ext}`;
}

/**
 * Generate a unique S3 key for a book cover image
 */
export function generateCoverS3Key(bookId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const timestamp = Date.now();
  return `covers/${bookId}/${timestamp}.${ext}`;
}

/**
 * Get allowed content types for book uploads
 */
export function getAllowedContentTypes(): string[] {
  return [
    "application/pdf",
    "application/epub+zip",
    "application/x-mobipocket-ebook",
  ];
}

/**
 * Get allowed content types for cover image uploads
 */
export function getAllowedCoverContentTypes(): string[] {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"];
}

/**
 * Validate content type for book uploads
 */
export function isValidContentType(contentType: string): boolean {
  return getAllowedContentTypes().includes(contentType);
}

/**
 * Validate content type for cover image uploads
 */
export function isValidCoverContentType(contentType: string): boolean {
  return getAllowedCoverContentTypes().includes(contentType);
}

/**
 * Maximum cover image size in bytes (5MB)
 */
export const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;

// Note: Max file size is now stored in database. Use getUploadMaxSizeMB() from @/lib/db

/**
 * Health check - test S3 connectivity
 * Uses HeadBucket to verify the bucket exists and is accessible
 */
export async function checkS3Health(): Promise<boolean> {
  if (!isS3Configured()) {
    return false;
  }

  try {
    const client = getS3Client();
    // Use a simple HeadObject on a test key to check connectivity
    // This will fail gracefully if the key doesn't exist but confirms S3 access
    const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
    await client.send(new HeadBucketCommand({ Bucket: s3Config.bucket }));
    return true;
  } catch {
    return false;
  }
}
