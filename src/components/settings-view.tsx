import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Cloud,
  Upload,
  LayoutGrid,
  Loader2,
  Info,
  Shield,
  Gauge,
  Music,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLayout } from "@/components/ui/page-layout";
import { toast } from "sonner";
import type { PublicSettings } from "@/pages/api/settings";
import type { LibraryViewMode } from "@/types";

// Storage keys (same as library-view.tsx)
const VIEW_MODE_KEY = "bookish-library-view-mode";
const PAGE_SIZE_KEY = "bookish-library-page-size";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const MAX_FILE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1024, 2048];
const MAX_COVER_SIZE_OPTIONS = [1, 2, 5, 10, 20, 50];
const MAX_AUDIO_SIZE_OPTIONS = [100, 200, 500, 1024, 2048];
const MAX_VIDEO_SIZE_OPTIONS = [200, 500, 1024, 2048, 4096];
const VIEW_MODE_OPTIONS: { value: LibraryViewMode; label: string }[] = [
  { value: "list", label: "List View" },
  { value: "grid", label: "Grid View" },
  { value: "cards", label: "Cards View" },
  { value: "compact", label: "Compact View" },
];

function getStoredViewMode(): LibraryViewMode {
  if (typeof window === "undefined") return "list";
  return (localStorage.getItem(VIEW_MODE_KEY) as LibraryViewMode) || "list";
}

function getStoredPageSize(): number {
  if (typeof window === "undefined") return 20;
  const stored = localStorage.getItem(PAGE_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 20;
}

export function SettingsView() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(getStoredViewMode);
  const [pageSize, setPageSize] = useState(getStoredPageSize);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error("[Settings] Failed to fetch:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleViewModeChange = (mode: LibraryViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    toast.success("View mode updated");
  };

  const handlePageSizeChange = (size: string) => {
    const newSize = parseInt(size, 10);
    setPageSize(newSize);
    localStorage.setItem(PAGE_SIZE_KEY, String(newSize));
    toast.success("Page size updated");
  };

  const handleMaxFileSizeChange = async (size: string) => {
    const newSize = parseInt(size, 10);
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload: { maxSizeMB: newSize } }),
      });
      if (!res.ok) throw new Error("Failed to update setting");

      // Update local state
      setSettings((prev) =>
        prev
          ? { ...prev, upload: { ...prev.upload, maxSizeMB: newSize } }
          : prev
      );
      toast.success("Max file size updated", {
        description: `Books up to ${newSize >= 1024 ? `${newSize / 1024} GB` : `${newSize} MB`} can now be uploaded.`,
      });
    } catch (error) {
      console.error("[Settings] Failed to update max file size:", error);
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaxCoverSizeChange = async (size: string) => {
    const newSize = parseInt(size, 10);
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover: { maxSizeMB: newSize } }),
      });
      if (!res.ok) throw new Error("Failed to update setting");

      // Update local state
      setSettings((prev) =>
        prev ? { ...prev, cover: { ...prev.cover, maxSizeMB: newSize } } : prev
      );
      toast.success("Max cover image size updated", {
        description: `Cover images up to ${newSize} MB can now be uploaded.`,
      });
    } catch (error) {
      console.error("[Settings] Failed to update max cover size:", error);
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaxAudioSizeChange = async (size: string) => {
    const newSize = parseInt(size, 10);
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: { maxSizeMB: newSize } }),
      });
      if (!res.ok) throw new Error("Failed to update setting");

      // Update local state
      setSettings((prev) =>
        prev ? { ...prev, audio: { ...prev.audio, maxSizeMB: newSize } } : prev
      );
      toast.success("Max audio file size updated", {
        description: `Audio files up to ${newSize >= 1024 ? `${newSize / 1024} GB` : `${newSize} MB`} can now be uploaded.`,
      });
    } catch (error) {
      console.error("[Settings] Failed to update max audio size:", error);
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaxVideoSizeChange = async (size: string) => {
    const newSize = parseInt(size, 10);
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: { maxSizeMB: newSize } }),
      });
      if (!res.ok) throw new Error("Failed to update setting");

      // Update local state
      setSettings((prev) =>
        prev ? { ...prev, video: { ...prev.video, maxSizeMB: newSize } } : prev
      );
      toast.success("Max video file size updated", {
        description: `Video files up to ${newSize >= 1024 ? `${newSize / 1024} GB` : `${newSize} MB`} can now be uploaded.`,
      });
    } catch (error) {
      console.error("[Settings] Failed to update max video size:", error);
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileTypes = (types: string[]) => {
    return types.map((t) => {
      if (t === "application/pdf") return "PDF";
      if (t === "application/epub+zip") return "EPUB";
      return t;
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    return `${Math.floor(seconds / 3600)} hours`;
  };

  if (isLoading) {
    return (
      <PageLayout
        title="Settings"
        subtitle="Configure your reading preferences and view system information"
        maxWidth="6xl"
      >
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Settings"
      subtitle="Configure your reading preferences and view system information"
      onRefresh={() => {
        setIsLoading(true);
        fetchSettings();
      }}
      isRefreshing={isLoading}
      maxWidth="6xl"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Library Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="w-4 h-4" />
              Library Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="view-mode">Default View Mode</Label>
              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger id="view-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how books are displayed in your library
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-size">Items Per Page</Label>
              <Select
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger id="page-size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} items
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Number of books to show per page
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-4 h-4" />
              Upload Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-file-size">Max File Size</Label>
              <Select
                value={String(settings?.upload.maxSizeMB || 100)}
                onValueChange={handleMaxFileSizeChange}
                disabled={isSaving}
              >
                <SelectTrigger id="max-file-size" className="w-full">
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {MAX_FILE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size >= 1024 ? `${size / 1024} GB` : `${size} MB`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum allowed size for book uploads
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-cover-size">Max Cover Image Size</Label>
              <Select
                value={String(settings?.cover?.maxSizeMB || 5)}
                onValueChange={handleMaxCoverSizeChange}
                disabled={isSaving}
              >
                <SelectTrigger id="max-cover-size" className="w-full">
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {MAX_COVER_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} MB
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum allowed size for book cover images
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Allowed Types
              </span>
              <div className="flex gap-1">
                {settings &&
                  formatFileTypes(settings.upload.allowedTypes).map((type) => (
                    <Badge key={type} variant="outline">
                      {type}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">URL Expiry</span>
              <Badge variant="secondary">
                {settings && formatDuration(settings.upload.presignedUrlExpiry)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Audio Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="w-4 h-4" />
              Audio Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-audio-size">Max Audio File Size</Label>
              <Select
                value={String(settings?.audio?.maxSizeMB || 500)}
                onValueChange={handleMaxAudioSizeChange}
                disabled={isSaving}
              >
                <SelectTrigger id="max-audio-size" className="w-full">
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {MAX_AUDIO_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size >= 1024 ? `${size / 1024} GB` : `${size} MB`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum allowed size for audio file uploads (MP3, M4A, WAV,
                etc.)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Allowed Formats
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {["MP3", "M4A", "WAV", "OGG", "FLAC"].map((type) => (
                  <Badge key={type} variant="outline">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="w-4 h-4" />
              Video Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-video-size">Max Video File Size</Label>
              <Select
                value={String(settings?.video?.maxSizeMB || 1024)}
                onValueChange={handleMaxVideoSizeChange}
                disabled={isSaving}
              >
                <SelectTrigger id="max-video-size" className="w-full">
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {MAX_VIDEO_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size >= 1024 ? `${size / 1024} GB` : `${size} MB`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum allowed size for video file uploads (MP4, WebM, MKV,
                etc.)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Allowed Formats
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {["MP4", "WebM", "MKV", "MOV", "AVI"].map((type) => (
                  <Badge key={type} variant="outline">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="w-4 h-4" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge
                variant={
                  settings?.storage.isConfigured ? "default" : "secondary"
                }
              >
                {settings?.storage.type === "s3"
                  ? "S3 Compatible"
                  : "Not Configured"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {settings?.storage.isConfigured ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-sm text-yellow-600">
                      Not Configured
                    </span>
                  </>
                )}
              </div>
            </div>

            {settings?.storage.region && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Region</span>
                <Badge variant="outline">{settings.storage.region}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Database Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-4 h-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <Badge variant="default">PostgreSQL</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {settings?.database.isConfigured ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm text-red-600">Not Configured</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Authentication
              </span>
              <div className="flex items-center gap-1.5">
                {settings?.auth?.enabled ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-green-600">Enabled</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-sm text-yellow-600">Disabled</span>
                  </>
                )}
              </div>
            </div>

            {settings?.auth?.enabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Session Duration
                </span>
                <Badge variant="outline">
                  {settings.auth.sessionDurationHours} hours
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rate Limiting Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="w-4 h-4" />
              Rate Limiting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {settings?.rateLimiting?.enabled ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-green-600">Enabled</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="text-sm text-muted-foreground">
                      Disabled
                    </span>
                  </>
                )}
              </div>
            </div>

            {settings?.rateLimiting?.enabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Limit</span>
                <Badge variant="outline">
                  {settings.rateLimiting.requestsPerMinute} req/min
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  {settings?.app.version ?? "1.0.0"}
                </p>
                <p className="text-xs text-muted-foreground">Version</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold capitalize">
                  {settings?.app.environment ?? "development"}
                </p>
                <p className="text-xs text-muted-foreground">Environment</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">Next.js 16</p>
                <p className="text-xs text-muted-foreground">Framework</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t text-center">
              Bookish — A privacy-focused personal book reader
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
