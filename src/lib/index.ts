// Library barrel exports
// This provides a clean public API for importing utilities

// Core utilities
export { cn } from "./utils";

// Configuration
export { config, getConfig } from "./config";
export type { EnvConfig } from "./config";

// S3 utilities
export {
  isS3Configured,
  getS3Client,
  generateUploadPresignedUrl,
  deleteFromS3,
  fileExistsInS3,
  generateBookS3Key,
  getAllowedContentTypes,
  isValidContentType,
  checkS3Health,
} from "./s3";

// API utilities
export * from "./api";
