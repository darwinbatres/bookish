import { useState, useEffect } from "react";
import { fetchStats, type StorageStats } from "@/lib/api/client";
import {
  BookOpen,
  Bookmark,
  StickyNote,
  HardDrive,
  FileText,
  TrendingUp,
  RefreshCw,
  Star,
  ShoppingCart,
  FolderOpen,
  Clock,
  CheckCircle2,
  ImageIcon,
  Database,
  Activity,
  BookMarked,
  Music,
  ListMusic,
  Headphones,
  Video,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/ui/page-layout";

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes === 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatReadingTime(seconds: number | undefined | null): string {
  if (!seconds || seconds === 0 || isNaN(seconds)) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
}: StatCardProps) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-secondary">
          <Icon className={`w-4 h-4 ${iconColor || "text-muted-foreground"}`} />
        </div>
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
}

export function StatsView() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      console.error("[Bookish] Failed to fetch stats:", err);
      setError("Failed to load statistics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (isLoading) {
    return (
      <PageLayout
        title="Storage & Stats"
        subtitle="Your library at a glance"
        maxWidth="5xl"
      >
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !stats) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive text-sm mb-4">{error || "No data"}</p>
          <Button variant="outline" onClick={loadStats}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Storage & Stats"
      subtitle="Your library at a glance"
      onRefresh={loadStats}
      maxWidth="6xl"
      className="space-y-8"
    >
      {/* Library Overview */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Library Overview
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={BookOpen}
            label="Total Books"
            value={stats.totalBooks}
          />
          <StatCard
            icon={Star}
            label="Favorites"
            value={stats.totalFavorites}
            iconColor="text-amber-500"
          />
          <StatCard
            icon={ShoppingCart}
            label="Wishlist"
            value={stats.totalWishlist}
            iconColor="text-blue-500"
          />
          <StatCard
            icon={FolderOpen}
            label="Collections"
            value={stats.totalCollections}
          />
        </div>
      </div>

      {/* Reading Progress */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Reading Progress
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={stats.completedBooks}
            subValue={
              stats.totalBooks > 0
                ? `${Math.round((stats.completedBooks / stats.totalBooks) * 100)}% of library`
                : undefined
            }
            iconColor="text-green-500"
          />
          <StatCard
            icon={BookMarked}
            label="Pages Read"
            value={stats.pagesRead.toLocaleString()}
            subValue={
              stats.totalPages > 0
                ? `${Math.round((stats.pagesRead / stats.totalPages) * 100)}% of ${stats.totalPages.toLocaleString()} total`
                : undefined
            }
            iconColor="text-indigo-500"
          />
          <StatCard
            icon={Clock}
            label="Reading Time"
            value={formatReadingTime(stats.totalReadingTime)}
          />
          <StatCard
            icon={Bookmark}
            label="Bookmarks"
            value={stats.totalBookmarks}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={StickyNote} label="Notes" value={stats.totalNotes} />
          <StatCard
            icon={Activity}
            label="Reading Sessions"
            value={stats.totalReadingSessions}
            iconColor="text-cyan-500"
          />
        </div>
      </div>

      {/* Audio Library */}
      {stats.audioStats && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Audio Library
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Music}
              label="Audio Tracks"
              value={stats.audioStats.totalTracks}
              iconColor="text-violet-500"
            />
            <StatCard
              icon={Star}
              label="Favorites"
              value={stats.audioStats.totalFavorites}
              iconColor="text-amber-500"
            />
            <StatCard
              icon={ListMusic}
              label="Playlists"
              value={stats.audioStats.totalPlaylists}
              iconColor="text-pink-500"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.audioStats.completedTracks}
              subValue={
                stats.audioStats.totalTracks > 0
                  ? `${Math.round((stats.audioStats.completedTracks / stats.audioStats.totalTracks) * 100)}% of tracks`
                  : undefined
              }
              iconColor="text-green-500"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Headphones}
              label="Listening Time"
              value={formatReadingTime(stats.audioStats.totalListeningTime)}
              iconColor="text-cyan-500"
            />
            <StatCard
              icon={Activity}
              label="Sessions"
              value={stats.audioStats.totalListeningSessions}
            />
            <StatCard
              icon={Bookmark}
              label="Bookmarks"
              value={stats.audioStats.totalAudioBookmarks}
            />
            <StatCard
              icon={HardDrive}
              label="Audio Storage"
              value={formatBytes(stats.audioStats.totalStorageBytes)}
              iconColor="text-violet-500"
            />
          </div>
        </div>
      )}

      {/* Video Library */}
      {stats.videoStats && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Video Library
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Video}
              label="Video Tracks"
              value={stats.videoStats.totalTracks}
              iconColor="text-rose-500"
            />
            <StatCard
              icon={Star}
              label="Favorites"
              value={stats.videoStats.totalFavorites}
              iconColor="text-amber-500"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.videoStats.completedTracks}
              subValue={
                stats.videoStats.totalTracks > 0
                  ? `${Math.round((stats.videoStats.completedTracks / stats.videoStats.totalTracks) * 100)}% of videos`
                  : undefined
              }
              iconColor="text-green-500"
            />
            <StatCard
              icon={Clock}
              label="Watch Time"
              value={formatReadingTime(stats.videoStats.totalWatchTime)}
              iconColor="text-cyan-500"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Activity}
              label="Sessions"
              value={stats.videoStats.totalWatchingSessions}
            />
            <StatCard
              icon={Bookmark}
              label="Bookmarks"
              value={stats.videoStats.totalVideoBookmarks}
            />
            <StatCard
              icon={HardDrive}
              label="Video Storage"
              value={formatBytes(stats.videoStats.totalStorageBytes)}
              iconColor="text-rose-500"
            />
          </div>
        </div>
      )}

      {/* Image Library */}
      {stats.imageStats && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Image Library
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={ImageIcon}
              label="Total Images"
              value={stats.imageStats.totalImages}
              iconColor="text-pink-500"
            />
            <StatCard
              icon={Star}
              label="Favorites"
              value={stats.imageStats.totalFavorites}
              iconColor="text-amber-500"
            />
            <StatCard
              icon={HardDrive}
              label="Image Storage"
              value={formatBytes(stats.imageStats.totalStorageBytes)}
              iconColor="text-pink-500"
            />
          </div>
        </div>
      )}

      {/* Media Folders */}
      {stats.mediaFoldersStats && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Media Folders
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Folder}
              label="Total Folders"
              value={stats.mediaFoldersStats.totalFolders}
              iconColor="text-orange-500"
            />
            <StatCard
              icon={FileText}
              label="Total Items"
              value={stats.mediaFoldersStats.totalItems}
              subValue="Across all folders"
            />
            <StatCard
              icon={BookOpen}
              label="Books in Folders"
              value={stats.mediaFoldersStats.bookItems}
              iconColor="text-blue-500"
            />
            <StatCard
              icon={Music}
              label="Audio in Folders"
              value={stats.mediaFoldersStats.audioItems}
              iconColor="text-violet-500"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Video}
              label="Videos in Folders"
              value={stats.mediaFoldersStats.videoItems}
              iconColor="text-rose-500"
            />
            <StatCard
              icon={ImageIcon}
              label="Images in Folders"
              value={stats.mediaFoldersStats.imageItems}
              iconColor="text-pink-500"
            />
          </div>
        </div>
      )}

      {/* Storage */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Storage
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={HardDrive}
            label="Book Files"
            value={formatBytes(stats.totalStorageBytes)}
            subValue="Books & covers"
          />
          <StatCard
            icon={Music}
            label="Audio Files"
            value={formatBytes(stats.audioStats?.totalStorageBytes || 0)}
            subValue="Audio tracks"
            iconColor="text-violet-500"
          />
          <StatCard
            icon={Video}
            label="Video Files"
            value={formatBytes(stats.videoStats?.totalStorageBytes || 0)}
            subValue="Video tracks"
            iconColor="text-rose-500"
          />
          <StatCard
            icon={ImageIcon}
            label="Image Files"
            value={formatBytes(stats.imageStats?.totalStorageBytes || 0)}
            subValue="Images"
            iconColor="text-pink-500"
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={Database}
            label="Database"
            value={formatBytes(stats.databaseSizeBytes)}
            subValue="PostgreSQL size"
            iconColor="text-blue-500"
          />
          <StatCard
            icon={HardDrive}
            label="Total Storage"
            value={formatBytes(
              stats.totalStorageBytes +
                stats.databaseSizeBytes +
                (stats.audioStats?.totalStorageBytes || 0) +
                (stats.videoStats?.totalStorageBytes || 0) +
                (stats.imageStats?.totalStorageBytes || 0)
            )}
            subValue="All files + DB"
            iconColor="text-emerald-500"
          />
        </div>
      </div>

      {stats.booksByFormat.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Storage by Format
          </h3>
          <div className="space-y-3">
            {stats.booksByFormat.map(({ format, count, bytes }) => (
              <div
                key={format}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-secondary">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm uppercase">{format}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? "file" : "files"}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-sm">{formatBytes(bytes)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Activity
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Books Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.booksAddedLast7Days}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.booksAddedLast30Days}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notes Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.notesAddedLast7Days}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.notesAddedLast30Days}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Bookmark className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Bookmarks Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.bookmarksAddedLast7Days}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.bookmarksAddedLast30Days}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Wishlist Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.wishlistAddedLast7Days}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.wishlistAddedLast30Days}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Collections Created</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.collectionsAddedLast7Days}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.collectionsAddedLast30Days}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Music className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium">Audio Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.audioTracksAddedLast7Days || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.audioTracksAddedLast30Days || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Video className="w-4 h-4 text-rose-500" />
              <span className="text-sm font-medium">Videos Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.videosAddedLast7Days || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.videosAddedLast30Days || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-pink-500" />
              <span className="text-sm font-medium">Images Added</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.imagesAddedLast7Days || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.imagesAddedLast30Days || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Folder className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Folders Created</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 7 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.foldersAddedLast7Days || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-semibold">
                  {stats.recentActivity.foldersAddedLast30Days || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground/60 text-center pt-4 border-t border-border">
        All data stored in PostgreSQL • Files in S3-compatible storage
      </div>
    </PageLayout>
  );
}
