import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MaxWidth = "4xl" | "5xl" | "6xl" | "7xl";

const MAX_WIDTH_CLASSES: Record<MaxWidth, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

interface PageLayoutProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional refresh handler - shows refresh button when provided */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Optional action button(s) to show in header */
  headerAction?: React.ReactNode;
  /** Page content */
  children: React.ReactNode;
  /** Additional className for the content wrapper */
  className?: string;
  /** Use full height with flex column (for pages with sticky footers) */
  fullHeight?: boolean;
  /** Optional sticky footer content (only used with fullHeight) */
  footer?: React.ReactNode;
  /** Maximum width of the content area. Defaults to 6xl (1152px) */
  maxWidth?: MaxWidth;
}

/**
 * Consistent page layout wrapper for all main views.
 * Provides consistent padding, header styling, and optional max-width.
 *
 * @example
 * ```tsx
 * // Simple page with default width (6xl)
 * <PageLayout title="Library" subtitle="53 books">
 *   <BookList />
 * </PageLayout>
 *
 * // Narrower page
 * <PageLayout title="Settings" maxWidth="4xl">
 *   <SettingsForm />
 * </PageLayout>
 *
 * // Full height with sticky footer
 * <PageLayout title="Library" fullHeight footer={<Pagination />}>
 *   <BookList />
 * </PageLayout>
 * ```
 */
export function PageLayout({
  title,
  subtitle,
  onRefresh,
  isRefreshing,
  headerAction,
  children,
  className,
  fullHeight = false,
  footer,
  maxWidth = "6xl",
}: PageLayoutProps) {
  const maxWidthClass = MAX_WIDTH_CLASSES[maxWidth];

  return (
    <div
      className={cn(
        fullHeight ? "h-full flex flex-col" : "h-full overflow-auto",
        !fullHeight && "p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12"
      )}
    >
      <div
        className={cn(
          maxWidthClass,
          "mx-auto",
          fullHeight &&
            "flex-1 flex flex-col p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 overflow-auto",
          className
        )}
      >
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-muted-foreground text-sm mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {headerAction}
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  aria-label={`Refresh ${title.toLowerCase()}`}
                >
                  <RefreshCw
                    className={cn("w-4 h-4", isRefreshing && "animate-spin")}
                  />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {children}
      </div>

      {/* Sticky Footer (only with fullHeight) */}
      {fullHeight && footer && (
        <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
          <div className={cn(maxWidthClass, "mx-auto")}>{footer}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Standalone sticky footer wrapper for pages that need pagination or action bars.
 * Use this when you need the footer outside of PageLayout (rare cases).
 * Prefer using PageLayout's `footer` prop instead.
 */
export function PageFooter({
  children,
  maxWidth = "6xl",
}: {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-popover/80 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-3 safe-area-inset-bottom">
      <div className={cn(MAX_WIDTH_CLASSES[maxWidth], "mx-auto")}>
        {children}
      </div>
    </div>
  );
}
