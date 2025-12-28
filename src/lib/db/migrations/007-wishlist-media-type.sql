-- Migration 007: Add media_type to wishlist for multi-media support
-- Created: December 2024

-- Add media_type column to wishlist table
-- Supports: 'book', 'audio', 'video' (defaults to 'book' for backwards compatibility)
ALTER TABLE wishlist 
ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) NOT NULL DEFAULT 'book';

-- Add check constraint for valid media types
DO $$ BEGIN
    ALTER TABLE wishlist 
    ADD CONSTRAINT wishlist_media_type_check 
    CHECK (media_type IN ('book', 'audio', 'video'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add index for filtering by media type
CREATE INDEX IF NOT EXISTS idx_wishlist_media_type ON wishlist(media_type);

-- Add composite index for common queries (media_type + priority + created_at)
CREATE INDEX IF NOT EXISTS idx_wishlist_media_type_priority ON wishlist(media_type, priority DESC, created_at DESC);

-- Update comment
COMMENT ON TABLE wishlist IS 'Wishlist items - media you want to acquire/consume (books, audio, video)';
COMMENT ON COLUMN wishlist.media_type IS 'Type of media: book, audio, or video';
