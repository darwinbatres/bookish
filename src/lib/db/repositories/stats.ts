import { getPool } from "../pool";

export interface StorageStats {
  totalBooks: number;
  totalFavorites: number;
  totalWishlist: number;
  totalBookmarks: number;
  totalNotes: number;
  totalCollections: number;
  totalReadingSessions: number;
  totalReadingTime: number; // seconds
  completedBooks: number;
  booksWithCovers: number;
  totalStorageBytes: number;
  databaseSizeBytes: number; // PostgreSQL database size
  // Reading progress stats
  totalPages: number; // Total pages across all books
  pagesRead: number; // Sum of current_page across all books
  booksByFormat: { format: string; count: number; bytes: number }[];
  recentActivity: {
    booksAddedLast7Days: number;
    booksAddedLast30Days: number;
    notesAddedLast7Days: number;
    notesAddedLast30Days: number;
    bookmarksAddedLast7Days: number;
    bookmarksAddedLast30Days: number;
    wishlistAddedLast7Days: number;
    wishlistAddedLast30Days: number;
    collectionsAddedLast7Days: number;
    collectionsAddedLast30Days: number;
  };
}

export async function getStorageStats(): Promise<StorageStats> {
  const pool = getPool();

  // Run all queries in parallel for efficiency
  const [
    bookCountResult,
    favoritesCountResult,
    wishlistCountResult,
    bookmarkCountResult,
    noteCountResult,
    collectionsCountResult,
    readingSessionsCountResult,
    readingTimeResult,
    completedBooksResult,
    booksWithCoversResult,
    totalSizeResult,
    databaseSizeResult,
    formatStatsResult,
    pageProgressResult,
    recentBooksResult,
    recentNotesResult,
    recentBookmarksResult,
    recentWishlistResult,
    recentCollectionsResult,
  ] = await Promise.all([
    // Total books
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM books"),

    // Total favorites
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM books WHERE is_favorite = true"
    ),

    // Total wishlist items
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM wishlist"),

    // Total bookmarks
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM bookmarks"),

    // Total notes
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM notes"),

    // Total collections
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM collections"),

    // Total reading sessions
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM reading_sessions"
    ),

    // Total reading time (in seconds)
    pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(total_reading_time), 0) as total FROM books"
    ),

    // Completed books
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM books WHERE completed_at IS NOT NULL"
    ),

    // Books with covers
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM books WHERE cover_url IS NOT NULL AND cover_url != ''"
    ),

    // Total storage size
    pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(file_size), 0) as total FROM books"
    ),

    // Database size (PostgreSQL)
    pool.query<{ size: string }>(
      "SELECT pg_database_size(current_database()) as size"
    ),

    // Books by format with size
    pool.query<{ format: string; count: string; bytes: string }>(
      `SELECT format, 
              COUNT(*) as count, 
              COALESCE(SUM(file_size), 0) as bytes 
       FROM books 
       GROUP BY format 
       ORDER BY count DESC`
    ),

    // Total pages and pages read progress
    pool.query<{ total_pages: string; pages_read: string }>(
      `SELECT 
        COALESCE(SUM(total_pages), 0) as total_pages,
        COALESCE(SUM(current_page), 0) as pages_read
       FROM books`
    ),

    // Recent books activity
    pool.query<{ last7: string; last30: string }>(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM books`
    ),

    // Recent notes activity
    pool.query<{ last7: string; last30: string }>(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM notes`
    ),

    // Recent bookmarks activity
    pool.query<{ last7: string; last30: string }>(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM bookmarks`
    ),

    // Recent wishlist activity
    pool.query<{ last7: string; last30: string }>(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM wishlist`
    ),

    // Recent collections activity
    pool.query<{ last7: string; last30: string }>(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM collections`
    ),
  ]);

  return {
    totalBooks: parseInt(bookCountResult.rows[0].count, 10),
    totalFavorites: parseInt(favoritesCountResult.rows[0].count, 10),
    totalWishlist: parseInt(wishlistCountResult.rows[0].count, 10),
    totalBookmarks: parseInt(bookmarkCountResult.rows[0].count, 10),
    totalNotes: parseInt(noteCountResult.rows[0].count, 10),
    totalCollections: parseInt(collectionsCountResult.rows[0].count, 10),
    totalReadingSessions: parseInt(
      readingSessionsCountResult.rows[0].count,
      10
    ),
    totalReadingTime: parseInt(readingTimeResult.rows[0].total, 10),
    completedBooks: parseInt(completedBooksResult.rows[0].count, 10),
    booksWithCovers: parseInt(booksWithCoversResult.rows[0].count, 10),
    totalStorageBytes: parseInt(totalSizeResult.rows[0].total, 10),
    databaseSizeBytes: parseInt(databaseSizeResult.rows[0].size, 10),
    totalPages: parseInt(pageProgressResult.rows[0].total_pages, 10),
    pagesRead: parseInt(pageProgressResult.rows[0].pages_read, 10),
    booksByFormat: formatStatsResult.rows.map((row) => ({
      format: row.format,
      count: parseInt(row.count, 10),
      bytes: parseInt(row.bytes, 10),
    })),
    recentActivity: {
      booksAddedLast7Days: parseInt(recentBooksResult.rows[0].last7, 10),
      booksAddedLast30Days: parseInt(recentBooksResult.rows[0].last30, 10),
      notesAddedLast7Days: parseInt(recentNotesResult.rows[0].last7, 10),
      notesAddedLast30Days: parseInt(recentNotesResult.rows[0].last30, 10),
      bookmarksAddedLast7Days: parseInt(
        recentBookmarksResult.rows[0].last7,
        10
      ),
      bookmarksAddedLast30Days: parseInt(
        recentBookmarksResult.rows[0].last30,
        10
      ),
      wishlistAddedLast7Days: parseInt(recentWishlistResult.rows[0].last7, 10),
      wishlistAddedLast30Days: parseInt(
        recentWishlistResult.rows[0].last30,
        10
      ),
      collectionsAddedLast7Days: parseInt(
        recentCollectionsResult.rows[0].last7,
        10
      ),
      collectionsAddedLast30Days: parseInt(
        recentCollectionsResult.rows[0].last30,
        10
      ),
    },
  };
}
