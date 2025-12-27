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
  // Audio stats
  audioStats: {
    totalTracks: number;
    totalFavorites: number;
    totalPlaylists: number;
    completedTracks: number;
    totalListeningTime: number; // seconds
    totalListeningSessions: number;
    totalAudioBookmarks: number;
    totalStorageBytes: number;
    tracksByFormat: { format: string; count: number; bytes: number }[];
  };
  // Video stats (December 2024)
  videoStats: {
    totalVideos: number;
    totalFavorites: number;
    completedVideos: number;
    totalWatchingTime: number; // seconds
    totalWatchingSessions: number;
    totalVideoBookmarks: number;
    totalStorageBytes: number;
    videosByFormat: { format: string; count: number; bytes: number }[];
  };
  // Media folders stats (December 2024)
  mediaFoldersStats: {
    totalFolders: number;
    totalItems: number;
    bookItems: number;
    audioItems: number;
    videoItems: number;
  };
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
    audioTracksAddedLast7Days: number;
    audioTracksAddedLast30Days: number;
    videosAddedLast7Days: number;
    videosAddedLast30Days: number;
    foldersAddedLast7Days: number;
    foldersAddedLast30Days: number;
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
    // Audio queries
    audioTracksResult,
    audioFavoritesResult,
    playlistsResult,
    completedAudioResult,
    listeningTimeResult,
    listeningSessResult,
    audioBookmarksResult,
    audioSizeResult,
    audioFormatResult,
    recentAudioResult,
    // Video queries (December 2024)
    videoTracksResult,
    videoFavoritesResult,
    completedVideoResult,
    watchingTimeResult,
    watchingSessResult,
    videoBookmarksResult,
    videoSizeResult,
    videoFormatResult,
    recentVideoResult,
    // Media folders queries (December 2024)
    mediaFoldersResult,
    folderItemsResult,
    recentFoldersResult,
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

    // Audio: Total tracks
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM audio_tracks"),

    // Audio: Total favorites
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM audio_tracks WHERE is_favorite = true"
    ),

    // Audio: Total playlists
    pool.query<{ count: string }>("SELECT COUNT(*) as count FROM playlists"),

    // Audio: Completed tracks
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM audio_tracks WHERE completed_at IS NOT NULL"
    ),

    // Audio: Total listening time
    pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(total_listening_time), 0) as total FROM audio_tracks"
    ),

    // Audio: Total listening sessions
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM listening_sessions"
    ),

    // Audio: Total bookmarks
    pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM audio_bookmarks"
    ),

    // Audio: Total storage size
    pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(file_size), 0) as total FROM audio_tracks"
    ),

    // Audio: Tracks by format
    pool.query<{ format: string; count: string; bytes: string }>(
      `SELECT format, 
              COUNT(*) as count, 
              COALESCE(SUM(file_size), 0) as bytes 
       FROM audio_tracks 
       GROUP BY format 
       ORDER BY count DESC`
    ),

    // Recent audio activity
    pool.query<{ last7: string; last30: string }>(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM audio_tracks`
    ),

    // Video queries (December 2024)
    // Video: Total videos
    pool
      .query<{ count: string }>("SELECT COUNT(*) as count FROM video_tracks")
      .catch(() => ({ rows: [{ count: "0" }] })),

    // Video: Total favorites
    pool
      .query<{
        count: string;
      }>("SELECT COUNT(*) as count FROM video_tracks WHERE is_favorite = true")
      .catch(() => ({ rows: [{ count: "0" }] })),

    // Video: Completed videos
    pool
      .query<{
        count: string;
      }>("SELECT COUNT(*) as count FROM video_tracks WHERE completed_at IS NOT NULL")
      .catch(() => ({ rows: [{ count: "0" }] })),

    // Video: Total watching time
    pool
      .query<{
        total: string;
      }>("SELECT COALESCE(SUM(total_watching_time), 0) as total FROM video_tracks")
      .catch(() => ({ rows: [{ total: "0" }] })),

    // Video: Total watching sessions
    pool
      .query<{ count: string }>("SELECT COUNT(*) as count FROM video_sessions")
      .catch(() => ({ rows: [{ count: "0" }] })),

    // Video: Total bookmarks
    pool
      .query<{ count: string }>("SELECT COUNT(*) as count FROM video_bookmarks")
      .catch(() => ({ rows: [{ count: "0" }] })),

    // Video: Total storage size
    pool
      .query<{
        total: string;
      }>("SELECT COALESCE(SUM(file_size), 0) as total FROM video_tracks")
      .catch(() => ({ rows: [{ total: "0" }] })),

    // Video: Videos by format
    pool
      .query<{ format: string; count: string; bytes: string }>(
        `SELECT format, 
              COUNT(*) as count, 
              COALESCE(SUM(file_size), 0) as bytes 
       FROM video_tracks 
       GROUP BY format 
       ORDER BY count DESC`
      )
      .catch(() => ({ rows: [] })),

    // Recent video activity
    pool
      .query<{ last7: string; last30: string }>(
        `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM video_tracks`
      )
      .catch(() => ({ rows: [{ last7: "0", last30: "0" }] })),

    // Media folders queries (December 2024)
    // Total folders
    pool
      .query<{ count: string }>("SELECT COUNT(*) as count FROM media_folders")
      .catch(() => ({ rows: [{ count: "0" }] })),

    // Folder items breakdown
    pool
      .query<{ total: string; books: string; audio: string; video: string }>(
        `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE item_type = 'book') as books,
        COUNT(*) FILTER (WHERE item_type = 'audio') as audio,
        COUNT(*) FILTER (WHERE item_type = 'video') as video
       FROM media_folder_items`
      )
      .catch(() => ({
        rows: [{ total: "0", books: "0", audio: "0", video: "0" }],
      })),

    // Recent folders activity
    pool
      .query<{ last7: string; last30: string }>(
        `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last7,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last30
       FROM media_folders`
      )
      .catch(() => ({ rows: [{ last7: "0", last30: "0" }] })),
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
      audioTracksAddedLast7Days: parseInt(
        recentAudioResult.rows[0]?.last7 || "0",
        10
      ),
      audioTracksAddedLast30Days: parseInt(
        recentAudioResult.rows[0]?.last30 || "0",
        10
      ),
      videosAddedLast7Days: parseInt(
        recentVideoResult.rows[0]?.last7 || "0",
        10
      ),
      videosAddedLast30Days: parseInt(
        recentVideoResult.rows[0]?.last30 || "0",
        10
      ),
      foldersAddedLast7Days: parseInt(
        recentFoldersResult.rows[0]?.last7 || "0",
        10
      ),
      foldersAddedLast30Days: parseInt(
        recentFoldersResult.rows[0]?.last30 || "0",
        10
      ),
    },
    audioStats: {
      totalTracks: parseInt(audioTracksResult.rows[0]?.count || "0", 10),
      totalFavorites: parseInt(audioFavoritesResult.rows[0]?.count || "0", 10),
      totalPlaylists: parseInt(playlistsResult.rows[0]?.count || "0", 10),
      completedTracks: parseInt(completedAudioResult.rows[0]?.count || "0", 10),
      totalListeningTime: parseInt(
        listeningTimeResult.rows[0]?.total || "0",
        10
      ),
      totalListeningSessions: parseInt(
        listeningSessResult.rows[0]?.count || "0",
        10
      ),
      totalAudioBookmarks: parseInt(
        audioBookmarksResult.rows[0]?.count || "0",
        10
      ),
      totalStorageBytes: parseInt(audioSizeResult.rows[0]?.total || "0", 10),
      tracksByFormat: (audioFormatResult.rows || []).map((row) => ({
        format: row.format,
        count: parseInt(row.count, 10),
        bytes: parseInt(row.bytes, 10),
      })),
    },
    // Video stats (December 2024)
    videoStats: {
      totalVideos: parseInt(videoTracksResult.rows[0]?.count || "0", 10),
      totalFavorites: parseInt(videoFavoritesResult.rows[0]?.count || "0", 10),
      completedVideos: parseInt(completedVideoResult.rows[0]?.count || "0", 10),
      totalWatchingTime: parseInt(watchingTimeResult.rows[0]?.total || "0", 10),
      totalWatchingSessions: parseInt(
        watchingSessResult.rows[0]?.count || "0",
        10
      ),
      totalVideoBookmarks: parseInt(
        videoBookmarksResult.rows[0]?.count || "0",
        10
      ),
      totalStorageBytes: parseInt(videoSizeResult.rows[0]?.total || "0", 10),
      videosByFormat: (videoFormatResult.rows || []).map((row) => ({
        format: row.format,
        count: parseInt(row.count, 10),
        bytes: parseInt(row.bytes, 10),
      })),
    },
    // Media folders stats (December 2024)
    mediaFoldersStats: {
      totalFolders: parseInt(mediaFoldersResult.rows[0]?.count || "0", 10),
      totalItems: parseInt(folderItemsResult.rows[0]?.total || "0", 10),
      bookItems: parseInt(folderItemsResult.rows[0]?.books || "0", 10),
      audioItems: parseInt(folderItemsResult.rows[0]?.audio || "0", 10),
      videoItems: parseInt(folderItemsResult.rows[0]?.video || "0", 10),
    },
  };
}
