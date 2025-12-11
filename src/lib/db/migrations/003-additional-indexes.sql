-- Additional indexes for improved scalability
-- These indexes help with large datasets (100k+ records)

-- Bookmarks: index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- Notes: index for recent activity and page-specific queries
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_book_page ON notes(book_id, page);
