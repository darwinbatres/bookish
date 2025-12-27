-- Migration: 005-video-support.sql
-- Description: Add video support with watching tracking
-- Created: 2024-12-27

-- ============================================================================
-- VIDEO TRACKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    format VARCHAR(10) NOT NULL CHECK (format IN ('mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v')),
    -- Duration and position in seconds
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    current_position INTEGER NOT NULL DEFAULT 0,
    -- S3 storage
    s3_key VARCHAR(500),
    file_size BIGINT,
    original_filename VARCHAR(500),
    cover_url VARCHAR(1000),
    -- Watching time tracking (total seconds watched across all sessions)
    total_watching_time INTEGER NOT NULL DEFAULT 0,
    -- Completion tracking
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Favorite flag
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    -- Timestamps
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VIDEO BOOKMARKS TABLE (timestamp markers within video)
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES video_tracks(id) ON DELETE CASCADE,
    position_seconds INTEGER NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate bookmarks at same position
    UNIQUE(video_id, position_seconds)
);

-- ============================================================================
-- VIDEO WATCHING SESSIONS TABLE (for analytics and resume functionality)
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES video_tracks(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    -- Position tracking in seconds
    start_position INTEGER NOT NULL DEFAULT 0,
    end_position INTEGER,
    -- Calculated duration (for quick aggregation)
    duration_seconds INTEGER
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Video tracks indexes
CREATE INDEX IF NOT EXISTS idx_video_tracks_last_played ON video_tracks(last_played_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_tracks_added_at ON video_tracks(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_tracks_updated_at ON video_tracks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_tracks_is_favorite ON video_tracks(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_video_tracks_completed ON video_tracks(completed_at) WHERE completed_at IS NOT NULL;

-- Trigram indexes for fast text search
CREATE INDEX IF NOT EXISTS idx_video_tracks_title_trgm ON video_tracks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_video_tracks_description_trgm ON video_tracks USING gin (description gin_trgm_ops);

-- Video bookmarks indexes
CREATE INDEX IF NOT EXISTS idx_video_bookmarks_video_id ON video_bookmarks(video_id);
CREATE INDEX IF NOT EXISTS idx_video_bookmarks_created_at ON video_bookmarks(created_at DESC);

-- Video sessions indexes
CREATE INDEX IF NOT EXISTS idx_video_sessions_video_id ON video_sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_video_ended ON video_sessions(video_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_video_sessions_started_at ON video_sessions(started_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Video tracks trigger
DROP TRIGGER IF EXISTS update_video_tracks_updated_at ON video_tracks;
CREATE TRIGGER update_video_tracks_updated_at 
    BEFORE UPDATE ON video_tracks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT SETTINGS FOR VIDEO UPLOADS
-- ============================================================================
INSERT INTO app_settings (key, value, description)
VALUES (
    'video.upload.maxSizeMB',
    '2048',
    'Maximum video file upload size in megabytes (default 2GB)'
) ON CONFLICT (key) DO NOTHING;
