-- Migration: Add favorites and wishlist features
-- This migration is idempotent (safe to run multiple times)

-- Add is_favorite column to books table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'books' AND column_name = 'is_favorite'
    ) THEN
        ALTER TABLE books ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- Create index for favorites (if not exists)
CREATE INDEX IF NOT EXISTS idx_books_is_favorite ON books(is_favorite) WHERE is_favorite = TRUE;

-- Create wishlist table if it doesn't exist
CREATE TABLE IF NOT EXISTS wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(500),
    notes TEXT,
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 2),
    url VARCHAR(2000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_priority ON wishlist(priority DESC);
CREATE INDEX IF NOT EXISTS idx_wishlist_created_at ON wishlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlist_title_trgm ON wishlist USING gin (title gin_trgm_ops);

-- Wishlist updated_at trigger
DROP TRIGGER IF EXISTS update_wishlist_updated_at ON wishlist;
CREATE TRIGGER update_wishlist_updated_at BEFORE UPDATE ON wishlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
