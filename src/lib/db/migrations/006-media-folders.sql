-- Migration: 006-media-folders.sql
-- Description: Add media folders for grouping books, audio, and videos
-- Created: 2024-12-27

-- ============================================================================
-- MEDIA FOLDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    cover_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MEDIA FOLDER ITEMS TABLE (junction table for folder contents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_folder_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES media_folders(id) ON DELETE CASCADE,
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('book', 'audio', 'video')),
    item_id UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate items in same folder
    UNIQUE(folder_id, item_type, item_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Media folders indexes
CREATE INDEX IF NOT EXISTS idx_media_folders_sort_order ON media_folders(sort_order);
CREATE INDEX IF NOT EXISTS idx_media_folders_name_trgm ON media_folders USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_media_folders_updated_at ON media_folders(updated_at DESC);

-- Media folder items indexes
CREATE INDEX IF NOT EXISTS idx_media_folder_items_folder_id ON media_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_folder_items_item ON media_folder_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_media_folder_items_sort_order ON media_folder_items(folder_id, sort_order);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Media folders trigger
DROP TRIGGER IF EXISTS update_media_folders_updated_at ON media_folders;
CREATE TRIGGER update_media_folders_updated_at 
    BEFORE UPDATE ON media_folders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
