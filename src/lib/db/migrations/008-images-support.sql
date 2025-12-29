-- Migration: 008-images-support.sql
-- Description: Add image support with gallery features
-- Created: 2024-12-28

-- ============================================================================
-- IMAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    format VARCHAR(10) NOT NULL CHECK (format IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'heic')),
    -- Image dimensions
    width INTEGER,
    height INTEGER,
    -- S3 storage
    s3_key VARCHAR(500),
    file_size BIGINT,
    original_filename VARCHAR(500),
    -- Thumbnail (smaller version for list views)
    thumbnail_url VARCHAR(1000),
    -- EXIF/metadata
    taken_at TIMESTAMP WITH TIME ZONE,
    camera_model VARCHAR(255),
    -- Organization
    album VARCHAR(255),
    tags TEXT[], -- Array of tags for filtering
    -- Favorite flag
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    -- View tracking
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    -- Timestamps
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Images indexes
CREATE INDEX IF NOT EXISTS idx_images_added_at ON images(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_updated_at ON images(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_last_viewed ON images(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_is_favorite ON images(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_images_album ON images(album) WHERE album IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_taken_at ON images(taken_at DESC) WHERE taken_at IS NOT NULL;

-- Trigram indexes for fast text search
CREATE INDEX IF NOT EXISTS idx_images_title_trgm ON images USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_images_description_trgm ON images USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_images_album_trgm ON images USING gin (album gin_trgm_ops);

-- GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_images_tags ON images USING gin (tags);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Images trigger
DROP TRIGGER IF EXISTS update_images_updated_at ON images;
CREATE TRIGGER update_images_updated_at 
    BEFORE UPDATE ON images 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UPDATE MEDIA FOLDERS TO SUPPORT IMAGES
-- ============================================================================

-- Update the check constraint on media_folder_items to include 'image'
ALTER TABLE media_folder_items DROP CONSTRAINT IF EXISTS media_folder_items_item_type_check;
ALTER TABLE media_folder_items ADD CONSTRAINT media_folder_items_item_type_check 
    CHECK (item_type IN ('book', 'audio', 'video', 'image'));

