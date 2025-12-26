-- Migration: 004-audio-support.sql
-- Description: Add audio/podcast support with playlists and listening tracking
-- Created: 2024-12-24

-- ============================================================================
-- PLAYLISTS TABLE (must be created before audio_tracks due to FK reference)
-- ============================================================================
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'music',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AUDIO TRACKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audio_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(500),
    album VARCHAR(500),
    format VARCHAR(10) NOT NULL CHECK (format IN ('mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'webm')),
    -- Duration and position in seconds (integer for simplicity, milliseconds would be overkill)
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    current_position INTEGER NOT NULL DEFAULT 0,
    -- S3 storage
    s3_key VARCHAR(500),
    file_size BIGINT,
    original_filename VARCHAR(500),
    cover_url VARCHAR(1000),
    -- Listening time tracking (total seconds listened across all sessions)
    total_listening_time INTEGER NOT NULL DEFAULT 0,
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
-- PLAYLIST ITEMS TABLE (many-to-many with ordering)
-- Allows same track in multiple playlists with independent ordering
-- ============================================================================
CREATE TABLE IF NOT EXISTS playlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate tracks in same playlist
    UNIQUE(playlist_id, track_id)
);

-- ============================================================================
-- LISTENING SESSIONS TABLE (for analytics and resume functionality)
-- ============================================================================
CREATE TABLE IF NOT EXISTS listening_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    -- Position tracking in seconds
    start_position INTEGER NOT NULL DEFAULT 0,
    end_position INTEGER,
    -- Calculated duration (for quick aggregation)
    duration_seconds INTEGER
);

-- ============================================================================
-- AUDIO BOOKMARKS TABLE (timestamp markers within audio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audio_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
    position_seconds INTEGER NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate bookmarks at same position
    UNIQUE(track_id, position_seconds)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Audio tracks indexes
CREATE INDEX IF NOT EXISTS idx_audio_tracks_last_played ON audio_tracks(last_played_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_added_at ON audio_tracks(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_updated_at ON audio_tracks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_is_favorite ON audio_tracks(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_audio_tracks_completed ON audio_tracks(completed_at) WHERE completed_at IS NOT NULL;

-- Trigram indexes for fast text search
CREATE INDEX IF NOT EXISTS idx_audio_tracks_title_trgm ON audio_tracks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_artist_trgm ON audio_tracks USING gin (artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_album_trgm ON audio_tracks USING gin (album gin_trgm_ops);

-- Playlist indexes
CREATE INDEX IF NOT EXISTS idx_playlists_sort_order ON playlists(sort_order);
CREATE INDEX IF NOT EXISTS idx_playlists_name_trgm ON playlists USING gin (name gin_trgm_ops);

-- Playlist items indexes
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_track_id ON playlist_items(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_sort_order ON playlist_items(playlist_id, sort_order);

-- Listening sessions indexes
CREATE INDEX IF NOT EXISTS idx_listening_sessions_track_id ON listening_sessions(track_id);
CREATE INDEX IF NOT EXISTS idx_listening_sessions_track_ended ON listening_sessions(track_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_listening_sessions_started_at ON listening_sessions(started_at DESC);

-- Audio bookmarks indexes
CREATE INDEX IF NOT EXISTS idx_audio_bookmarks_track_id ON audio_bookmarks(track_id);
CREATE INDEX IF NOT EXISTS idx_audio_bookmarks_created_at ON audio_bookmarks(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Audio tracks trigger
DROP TRIGGER IF EXISTS update_audio_tracks_updated_at ON audio_tracks;
CREATE TRIGGER update_audio_tracks_updated_at 
    BEFORE UPDATE ON audio_tracks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Playlists trigger
DROP TRIGGER IF EXISTS update_playlists_updated_at ON playlists;
CREATE TRIGGER update_playlists_updated_at 
    BEFORE UPDATE ON playlists 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT SETTINGS FOR AUDIO UPLOADS
-- ============================================================================
INSERT INTO app_settings (key, value, description)
VALUES (
    'audio.upload.maxSizeMB',
    '500',
    'Maximum audio file upload size in megabytes'
) ON CONFLICT (key) DO NOTHING;
