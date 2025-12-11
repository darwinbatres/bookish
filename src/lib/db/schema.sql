-- Shelf Book Reader Database Schema
-- PostgreSQL 16+
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram extension for fast text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Application settings table (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO
    app_settings (key, value, description)
VALUES
    (
        'upload.maxSizeMB',
        '100',
        'Maximum file upload size in megabytes'
    ) ON CONFLICT (key) DO NOTHING;

-- Collections (book groups) table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(500),
    format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'epub', 'mobi')),
    total_pages INTEGER NOT NULL DEFAULT 0,
    current_page INTEGER NOT NULL DEFAULT 1,
    s3_key VARCHAR(500),
    file_size BIGINT,
    original_filename VARCHAR(500),
    cover_url VARCHAR(1000),
    -- Reading time tracking (in seconds)
    total_reading_time INTEGER NOT NULL DEFAULT 0,
    -- Completion tracking
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Favorite flag
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    -- Collection reference
    collection_id UUID REFERENCES collections(id) ON DELETE
    SET
        NULL,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wishlist table (books you want but don't have yet)
CREATE TABLE IF NOT EXISTS wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(500),
    notes TEXT,
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 2),
    -- 0 = low, 1 = medium, 2 = high
    url VARCHAR(2000),
    -- Optional link to purchase/find
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page INTEGER NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(book_id, page)
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reading sessions table (for future analytics)
CREATE TABLE IF NOT EXISTS reading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    start_page INTEGER NOT NULL,
    end_page INTEGER,
    duration_seconds INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_books_last_opened ON books(last_opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_added_at ON books(added_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_collection_id ON books(collection_id);

CREATE INDEX IF NOT EXISTS idx_books_is_favorite ON books(is_favorite) WHERE is_favorite = TRUE;

CREATE INDEX IF NOT EXISTS idx_bookmarks_book_id ON bookmarks(book_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);

CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_book_page ON notes(book_id, page);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_ended ON reading_sessions(book_id, ended_at);

CREATE INDEX IF NOT EXISTS idx_collections_sort_order ON collections(sort_order);

CREATE INDEX IF NOT EXISTS idx_wishlist_priority ON wishlist(priority DESC);

CREATE INDEX IF NOT EXISTS idx_wishlist_created_at ON wishlist(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wishlist_title_trgm ON wishlist USING gin (title gin_trgm_ops);

-- Search indexes for scalable text search
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_books_author_trgm ON books USING gin (author gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_notes_content_trgm ON notes USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_collections_name_trgm ON collections USING gin (name gin_trgm_ops);

-- Updated_at trigger function
-- NOTE: Do NOT format this file - the $$ delimiters are PostgreSQL syntax
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to books
DROP TRIGGER IF EXISTS update_books_updated_at ON books;

CREATE TRIGGER update_books_updated_at BEFORE
UPDATE
    ON books FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to notes
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;

CREATE TRIGGER update_notes_updated_at BEFORE
UPDATE
    ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to collections
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;

CREATE TRIGGER update_collections_updated_at BEFORE
UPDATE
    ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to wishlist
DROP TRIGGER IF EXISTS update_wishlist_updated_at ON wishlist;

CREATE TRIGGER update_wishlist_updated_at BEFORE
UPDATE
    ON wishlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();