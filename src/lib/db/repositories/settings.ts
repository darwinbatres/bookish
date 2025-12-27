import { getPool } from "../pool";

export interface AppSetting {
  key: string;
  value: unknown;
  description?: string;
  updatedAt: string;
}

/**
 * Ensure the app_settings table exists
 */
async function ensureSettingsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      description TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

/**
 * Get a specific setting by key
 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const pool = getPool();
  try {
    const result = await pool.query(
      "SELECT value FROM app_settings WHERE key = $1",
      [key]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].value as T;
  } catch (error: unknown) {
    // If table doesn't exist, create it and return null
    if (error instanceof Error && error.message.includes("does not exist")) {
      await ensureSettingsTable();
      return null;
    }
    throw error;
  }
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const pool = getPool();
  try {
    const result = await pool.query(
      "SELECT key, value FROM app_settings ORDER BY key"
    );
    const settings: Record<string, unknown> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      await ensureSettingsTable();
      return {};
    }
    throw error;
  }
}

/**
 * Update or insert a setting
 */
export async function setSetting(
  key: string,
  value: unknown,
  description?: string
): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         description = COALESCE(EXCLUDED.description, app_settings.description),
         updated_at = NOW()`,
      [key, JSON.stringify(value), description]
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      await ensureSettingsTable();
      // Retry after creating table
      await pool.query(
        `INSERT INTO app_settings (key, value, description, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           description = COALESCE(EXCLUDED.description, app_settings.description),
           updated_at = NOW()`,
        [key, JSON.stringify(value), description]
      );
    } else {
      throw error;
    }
  }
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query("DELETE FROM app_settings WHERE key = $1", [
    key,
  ]);
  return (result.rowCount ?? 0) > 0;
}

// Typed helpers for common settings
export async function getUploadMaxSizeMB(): Promise<number> {
  const value = await getSetting<number>("upload.maxSizeMB");
  return value ?? 100; // Default to 100MB if not set
}

export async function setUploadMaxSizeMB(sizeMB: number): Promise<void> {
  await setSetting(
    "upload.maxSizeMB",
    sizeMB,
    "Maximum file upload size in megabytes"
  );
}

export async function getCoverMaxSizeMB(): Promise<number> {
  const value = await getSetting<number>("cover.maxSizeMB");
  return value ?? 5; // Default to 5MB if not set
}

export async function setCoverMaxSizeMB(sizeMB: number): Promise<void> {
  await setSetting(
    "cover.maxSizeMB",
    sizeMB,
    "Maximum cover image size in megabytes"
  );
}

export async function getAudioMaxSizeMB(): Promise<number> {
  const value = await getSetting<number>("audio.maxSizeMB");
  return value ?? 500; // Default to 500MB for audio files
}

export async function setAudioMaxSizeMB(sizeMB: number): Promise<void> {
  await setSetting(
    "audio.maxSizeMB",
    sizeMB,
    "Maximum audio file size in megabytes"
  );
}

// Video settings (December 2024)
export async function getVideoMaxSizeMB(): Promise<number> {
  const value = await getSetting<number>("video.upload.maxSizeMB");
  return value ?? 2048; // Default to 2GB for video files
}

export async function setVideoMaxSizeMB(sizeMB: number): Promise<void> {
  await setSetting(
    "video.upload.maxSizeMB",
    sizeMB,
    "Maximum video file upload size in megabytes"
  );
}
