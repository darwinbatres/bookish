-- Migration 009: Add 'image' to wishlist media_type
-- Created: December 2024
-- Description: Extends wishlist to support image media type for wishlisting photos/artwork

-- Drop existing check constraint
ALTER TABLE wishlist DROP CONSTRAINT IF EXISTS wishlist_media_type_check;

-- Add updated check constraint that includes 'image'
ALTER TABLE wishlist ADD CONSTRAINT wishlist_media_type_check 
    CHECK (media_type IN ('book', 'audio', 'video', 'image'));

-- Update comment
COMMENT ON COLUMN wishlist.media_type IS 'Type of media: book, audio, video, or image';
