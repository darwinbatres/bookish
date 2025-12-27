import type { NextApiRequest, NextApiResponse } from "next";
import { config } from "@/lib/config";
import { withAuth } from "@/lib/api";
import {
  getUploadMaxSizeMB,
  setUploadMaxSizeMB,
  getCoverMaxSizeMB,
  setCoverMaxSizeMB,
  getAudioMaxSizeMB,
  setAudioMaxSizeMB,
  getVideoMaxSizeMB,
  setVideoMaxSizeMB,
} from "@/lib/db";

export interface PublicSettings {
  app: {
    environment: string;
    version: string;
  };
  auth: {
    enabled: boolean;
    sessionDurationHours: number;
  };
  upload: {
    maxSizeMB: number;
    allowedTypes: string[];
    presignedUrlExpiry: number;
  };
  cover: {
    maxSizeMB: number;
    allowedTypes: string[];
  };
  audio: {
    maxSizeMB: number;
    allowedTypes: string[];
  };
  video: {
    maxSizeMB: number;
    allowedTypes: string[];
  };
  storage: {
    type: "s3" | "local";
    isConfigured: boolean;
    region?: string;
  };
  database: {
    isConfigured: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
  };
}

interface UpdateSettingsRequest {
  upload?: {
    maxSizeMB?: number;
  };
  cover?: {
    maxSizeMB?: number;
  };
  audio?: {
    maxSizeMB?: number;
  };
  video?: {
    maxSizeMB?: number;
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    PublicSettings | { success: boolean } | { error: string }
  >
) {
  // GET - Fetch all settings
  if (req.method === "GET") {
    try {
      // Get max sizes from database (with defaults)
      const [maxSizeMB, coverMaxSizeMB, audioMaxSizeMB, videoMaxSizeMB] =
        await Promise.all([
          getUploadMaxSizeMB(),
          getCoverMaxSizeMB(),
          getAudioMaxSizeMB(),
          getVideoMaxSizeMB(),
        ]);

      const settings: PublicSettings = {
        app: {
          environment: config.env.NODE_ENV,
          version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
        },
        auth: {
          enabled: config.auth.enabled,
          sessionDurationHours: Math.floor(config.auth.sessionDuration / 3600),
        },
        upload: {
          maxSizeMB,
          allowedTypes: config.upload.allowedTypes,
          presignedUrlExpiry: config.upload.presignedUrlExpiry,
        },
        cover: {
          maxSizeMB: coverMaxSizeMB,
          allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        },
        audio: {
          maxSizeMB: audioMaxSizeMB,
          allowedTypes: [
            "audio/mpeg",
            "audio/mp4",
            "audio/wav",
            "audio/ogg",
            "audio/flac",
            "audio/aac",
            "audio/webm",
          ],
        },
        video: {
          maxSizeMB: videoMaxSizeMB,
          allowedTypes: [
            "video/mp4",
            "video/webm",
            "video/x-matroska",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-m4v",
          ],
        },
        storage: {
          type: config.s3.isConfigured ? "s3" : "local",
          isConfigured: config.s3.isConfigured,
          region: config.s3.isConfigured ? config.s3.region : undefined,
        },
        database: {
          isConfigured: config.db.isConfigured,
        },
        rateLimiting: {
          enabled: config.env.RATE_LIMIT_ENABLED,
          requestsPerMinute: config.env.RATE_LIMIT_RPM,
        },
      };

      return res.status(200).json(settings);
    } catch (error) {
      console.error("[API] Failed to get settings:", error);
      return res.status(500).json({ error: "Failed to get settings" });
    }
  }

  // PATCH - Update settings
  if (req.method === "PATCH") {
    try {
      const body = req.body as UpdateSettingsRequest;

      // Validate and update max file size
      if (body.upload?.maxSizeMB !== undefined) {
        const maxSizeMB = body.upload.maxSizeMB;

        // Validate: must be a positive number, max 2GB
        if (
          typeof maxSizeMB !== "number" ||
          maxSizeMB < 1 ||
          maxSizeMB > 2048
        ) {
          return res.status(400).json({
            error: "maxSizeMB must be between 1 and 2048 MB",
          });
        }

        await setUploadMaxSizeMB(Math.floor(maxSizeMB));
      }

      // Validate and update max cover size
      if (body.cover?.maxSizeMB !== undefined) {
        const coverMaxSizeMB = body.cover.maxSizeMB;

        // Validate: must be a positive number, max 50MB for images
        if (
          typeof coverMaxSizeMB !== "number" ||
          coverMaxSizeMB < 1 ||
          coverMaxSizeMB > 50
        ) {
          return res.status(400).json({
            error: "cover.maxSizeMB must be between 1 and 50 MB",
          });
        }

        await setCoverMaxSizeMB(Math.floor(coverMaxSizeMB));
      }

      // Validate and update max audio size
      if (body.audio?.maxSizeMB !== undefined) {
        const audioMaxSizeMB = body.audio.maxSizeMB;

        // Validate: must be a positive number, max 2GB for audio
        if (
          typeof audioMaxSizeMB !== "number" ||
          audioMaxSizeMB < 1 ||
          audioMaxSizeMB > 2048
        ) {
          return res.status(400).json({
            error: "audio.maxSizeMB must be between 1 and 2048 MB",
          });
        }

        await setAudioMaxSizeMB(Math.floor(audioMaxSizeMB));
      }

      // Validate and update max video size
      if (body.video?.maxSizeMB !== undefined) {
        const videoMaxSizeMB = body.video.maxSizeMB;

        // Validate: must be a positive number, max 4GB for video
        if (
          typeof videoMaxSizeMB !== "number" ||
          videoMaxSizeMB < 1 ||
          videoMaxSizeMB > 4096
        ) {
          return res.status(400).json({
            error: "video.maxSizeMB must be between 1 and 4096 MB",
          });
        }

        await setVideoMaxSizeMB(Math.floor(videoMaxSizeMB));
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[API] Failed to update settings:", error);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default withAuth(handler);
