# Copilot Instructions for Bookish

## Important Workflow Rules

- **NEVER commit code without explicit user approval** - Always wait for the user to confirm before running `git commit`. Show the changes and ask for confirmation first.
- **NEVER push code without explicit user approval** - Same rule applies to `git push`.

## Project Overview

This is a personal book and audio reader application built with Next.js 16 using the **Pages Router** pattern. The app allows users to upload, manage, and read PDF and EPUB books, as well as listen to audiobooks and podcasts, with features like bookmarks, notes, reading/listening time tracking, favorites, wishlists, collections, custom covers, and completion celebrations.

## Tech Stack

- **Framework**: Next.js 16.x (Pages Router, NOT App Router)
- **Language**: TypeScript 5.x
- **React**: React 19.x
- **Styling**: Tailwind CSS 4.x with `@tailwindcss/postcss`
- **UI Library**: shadcn/ui (New York style)
- **PDF Rendering**: react-pdf 10.x with pdfjs-dist (dynamically imported with SSR disabled)
- **EPUB Rendering**: epubjs 0.3.x (dynamically imported with SSR disabled)
- **Validation**: Zod 4.x
- **Database**: PostgreSQL 16+ (via `pg` - no ORM)
- **Storage**: AWS S3 SDK v3 (compatible with DigitalOcean Spaces)
- **Authentication**: JWT sessions via `jose` library
- **Package Manager**: pnpm

## Folder Structure

```
src/
├── components/       # React components
│   ├── ui/          # shadcn/ui primitives (button, alert-dialog, sonner, etc.)
│   ├── library/     # Library-specific components (book cards, pagination, search)
│   └── *.tsx        # Feature components (LibraryView, ReaderView, etc.)
├── hooks/           # Custom React hooks
│   ├── use-confetti.ts      # Completion celebration hook
│   ├── use-reading-tracker.ts # Reading session tracking hook
│   ├── use-cover-url.ts     # Cover image URL resolution hook
│   ├── use-audio-player.ts  # HTML5 audio player controls
│   ├── use-listening-tracker.ts # Audio session tracking
│   └── use-media-session.ts # OS media controls (lock screen, media keys)
├── lib/             # Utilities
│   ├── api/         # Client-side API functions + middleware
│   │   ├── client.ts        # Fetch functions for all API endpoints
│   │   ├── errors.ts        # API error handling
│   │   ├── middleware.ts    # Request middleware (withMethods, withErrorHandler)
│   │   ├── auth-middleware.ts # Authentication middleware (withAuth)
│   │   └── index.ts         # Barrel export
│   ├── db/          # Database layer (PostgreSQL)
│   │   ├── pool.ts          # Connection pool singleton
│   │   ├── schema.sql       # Database schema
│   │   ├── migrate.ts       # Migration runner
│   │   ├── migrations/      # Incremental migrations for existing DBs
│   │   │   ├── 002-favorites-wishlist.sql
│   │   │   └── 003-additional-indexes.sql
│   │   ├── repositories/    # CRUD operations
│   │   │   ├── books.ts
│   │   │   ├── bookmarks.ts
│   │   │   ├── notes.ts
│   │   │   ├── sessions.ts  # Reading sessions
│   │   │   ├── collections.ts
│   │   │   ├── wishlist.ts  # Wishlist items
│   │   │   ├── settings.ts  # App settings
│   │   │   ├── audio-tracks.ts    # Audio track CRUD
│   │   │   ├── playlists.ts       # Playlist management
│   │   │   ├── playlist-items.ts  # Playlist track ordering
│   │   │   ├── audio-bookmarks.ts # Timestamp bookmarks
│   │   │   └── listening-sessions.ts # Audio session tracking
│   │   │   └── stats.ts
│   │   └── index.ts         # Barrel export
│   ├── auth.ts      # JWT session management
│   ├── config.ts    # Centralized config with Zod validation
│   ├── s3.ts        # S3 operations (upload, download, presigned URLs)
│   ├── utils.ts     # General utilities (cn, etc.)
│   └── index.ts     # Barrel export
├── pages/           # Next.js pages (Pages Router)
│   ├── api/         # API routes
│   │   ├── auth/    # Authentication endpoints
│   │   ├── books/   # Book endpoints (upload, cover-upload, stream, etc.)
│   │   ├── audio/   # Audio endpoints (upload, stream, download, etc.)
│   │   ├── playlists/ # Playlist endpoints
│   │   ├── collections/ # Collection endpoints
│   │   ├── wishlist/    # Wishlist endpoints
│   │   ├── settings.ts  # App settings
│   │   ├── stats.ts     # Storage statistics
│   │   └── health.ts
│   ├── _app.tsx     # App wrapper (includes Toaster)
│   ├── _document.tsx # Document template
│   ├── index.tsx    # Main page (Library)
│   └── login.tsx    # Login page
├── styles/          # Global CSS
└── types/           # TypeScript type definitions
    ├── book.ts      # Book types (DBBook, DBBookmark, DBNote, DBCollection, DBWishlistItem, etc.)
    ├── audio.ts     # Audio types (DBAudioTrack, DBPlaylist, etc.)
    └── index.ts     # Barrel export
```

## Coding Conventions

### TypeScript

- Use strict mode
- Prefer interfaces over types for object shapes
- Export types from `src/types/index.ts`
- Use Zod for API request validation

### Components

- Use functional components with hooks
- Client-side components don't need "use client" directive (Pages Router)
- Props interfaces named `ComponentNameProps`
- Destructure props in function signature

### File Naming

- Components: PascalCase (`BookUpload.tsx`)
- Utilities: kebab-case or camelCase (`books.ts`, `utils.ts`)
- Pages: kebab-case (`index.tsx`, `[id].tsx`)
- Types: PascalCase for interfaces, camelCase for files

### Imports

- Use `@/` alias for src folder imports
- Group imports: external, internal, relative, types

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";
```

### Styling

- Use Tailwind CSS classes
- Use `cn()` utility for conditional classes
- Follow shadcn/ui patterns for component styling

## API Routes

Located in `src/pages/api/`:

### Health & Settings

- `GET /api/health` - Health check (includes database and S3 status)
- `GET /api/stats` - Storage and library statistics
- `GET /api/settings` - Get application settings
- `PATCH /api/settings` - Update application settings (e.g., max upload size)

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Check authentication status

### Books

- `GET /api/books` - List all books (supports pagination, search, sorting)
- `POST /api/books` - Create a book
- `GET /api/books/:id` - Get a book
- `PATCH /api/books/:id` - Update a book (title, author, cover, favorite)
- `DELETE /api/books/:id` - Delete a book (and S3 files)
- `POST /api/books/upload` - Upload book file (proxied to S3)
- `POST /api/books/cover-upload` - Upload cover image (proxied to S3)
- `GET /api/books/stream` - Stream book/cover file from S3 (API Gateway pattern)
- `POST /api/books/upload-url` - Generate presigned upload URL (legacy, not used by UI)
- `POST /api/books/cover-upload-url` - Generate presigned cover upload URL (legacy)

### Bookmarks

- `GET /api/books/:id/bookmarks` - Get bookmarks for a book
- `POST /api/books/:id/bookmarks` - Add a bookmark
- `DELETE /api/books/:id/bookmarks` - Remove a bookmark

### Notes

- `GET /api/books/:id/notes` - Get notes for a book
- `POST /api/books/:id/notes` - Create a note
- `PATCH /api/books/:id/notes` - Update a note
- `DELETE /api/books/:id/notes` - Delete a note

### Reading Sessions

- `GET /api/books/:id/sessions` - Get active reading session
- `POST /api/books/:id/sessions` - Start a reading session
- `PATCH /api/books/:id/sessions` - End a reading session

### Collections

- `GET /api/collections` - List all collections
- `POST /api/collections` - Create a collection
- `GET /api/collections/:id` - Get a collection
- `PATCH /api/collections/:id` - Update a collection
- `DELETE /api/collections/:id` - Delete a collection

### Wishlist

- `GET /api/wishlist` - List all wishlist items
- `POST /api/wishlist` - Add item to wishlist
- `GET /api/wishlist/:id` - Get a wishlist item
- `PATCH /api/wishlist/:id` - Update a wishlist item
- `DELETE /api/wishlist/:id` - Remove from wishlist

### Audio Tracks

- `GET /api/audio` - List audio tracks (supports pagination, search, sorting)
- `POST /api/audio` - Create audio track record
- `POST /api/audio/upload` - Upload audio file (proxied to S3)
- `POST /api/audio/cover-upload` - Upload audio cover image (proxied to S3)
- `GET /api/audio/stream` - Stream audio with Range support (seeking)
- `GET /api/audio/download` - Download audio file with proper filename
- `GET /api/audio/metadata` - Get unique albums/artists for autocomplete
- `GET /api/audio/:id` - Get a single audio track
- `PATCH /api/audio/:id` - Update track (title, artist, album, position, duration, coverUrl, favorite)
- `DELETE /api/audio/:id` - Delete track (and S3 file)
- `GET /api/audio/:id/bookmarks` - Get timestamp bookmarks
- `POST /api/audio/:id/bookmarks` - Add timestamp bookmark
- `DELETE /api/audio/:id/bookmarks` - Remove bookmark
- `GET /api/audio/:id/sessions` - Get active listening session
- `POST /api/audio/:id/sessions` - Start listening session
- `PATCH /api/audio/:id/sessions` - End listening session

### Playlists

- `GET /api/playlists` - List all playlists
- `POST /api/playlists` - Create a playlist
- `GET /api/playlists/:id` - Get a playlist
- `PATCH /api/playlists/:id` - Update a playlist
- `DELETE /api/playlists/:id` - Delete a playlist
- `GET /api/playlists/:id/items` - Get playlist items (tracks)
- `POST /api/playlists/:id/items` - Add track to playlist
- `DELETE /api/playlists/:id/items` - Remove track from playlist
- `PATCH /api/playlists/:id/items` - Reorder playlist items

### API Pattern

```typescript
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Handle request
}
```

## State Management

- **Book metadata**: PostgreSQL via `lib/db/repositories`
- **Book files**: S3 with presigned URLs via `lib/s3.ts`
- **UI state**: React useState/useReducer
- **API calls**: Client-side fetch via `lib/api/client.ts`

## Key Components

- `LibraryView` - Main grid/table view of books with search, pagination, sorting
- `StatsView` - Storage and library analytics dashboard
- `SettingsView` - Application settings management
- `CollectionsView` - Manage book collections
- `WishlistView` - Manage wishlist items (books you want)
- `EditBookModal` - Modal for editing book details and favorites
- `ReaderView` - Reading interface (supports PDF and EPUB)
- `PdfReader` - PDF rendering with react-pdf
- `EpubReader` - EPUB rendering with epubjs
- `BookUpload` - File upload with proxied S3 integration
- `NoteModal` - Note-taking modal
- `ReadingPanel` - Reading controls and information panel
- `Sidebar` / `MobileNav` - Navigation
- `AudioLibraryView` - Audio track management grid
- `AudioTrackCard` - Individual track display card
- `AudioUpload` - Audio file upload component
- `AudioEditModal` - Modal for editing audio track details
- `MiniPlayer` - Persistent bottom audio player bar

## S3 Integration

Files are stored in S3-compatible storage (DigitalOcean Spaces, MinIO).

**Architecture:** Both uploads and downloads use the **API Gateway pattern**—the browser only communicates with the Next.js app, never directly with S3.

**Upload flow (proxied):**

1. Client sends file to `/api/books/upload` (or `/api/books/cover-upload` for covers)
2. App server receives file via multipart form data
3. App server uploads to S3 internally using `uploadToS3()`
4. App server returns `s3Key` to client
5. Client creates book record with s3Key in PostgreSQL

**Download/Reading flow (proxied):**

1. Client requests stream URL from `/api/books/stream?s3Key=...`
2. App server fetches file from S3 internally
3. App server streams file to browser

This architecture ensures:

- Only the app server is exposed to the internet (via Cloudflare Tunnel)
- S3/MinIO stays internal and never accessible from outside
- Works on all devices (mobile, desktop) without network configuration
- Single point of authentication and rate limiting
- Better security: S3 credentials never leave the server

> **Note:** Legacy presigned URL endpoints (`upload-url`, `cover-upload-url`) still exist for backwards compatibility but are not used by the UI.

## Docker

- Multi-stage build with `standalone` output
- Runs as non-root user (UID 1001)
- Health checks via `/api/health`
- MinIO available for local S3 testing
- Cloudflare Tunnel profile for secure production deployment
- tmpfs mount for file upload temp storage (256MB)

### Docker Profiles

| Profile         | Services Added      | Use Case                                                  |
| --------------- | ------------------- | --------------------------------------------------------- |
| (none)          | app, postgres       | Production with external S3 (DigitalOcean Spaces, AWS S3) |
| `local-storage` | + minio, minio-init | Local development with S3-compatible storage              |
| `tunnel`        | + cloudflared       | Secure internet exposure without opening ports            |

You can combine profiles as needed:

```bash
# Basic (external S3 required)
docker compose up -d

# Local development with MinIO
docker compose --profile local-storage up -d

# Production with Cloudflare Tunnel (external S3)
docker compose --profile tunnel up -d

# Local dev + Tunnel (testing tunnel locally)
docker compose --profile local-storage --profile tunnel up -d
```

## Environment Variables

See `.env.example` for all variables. Key ones:

- `POSTGRES_*` - PostgreSQL configuration (ALL REQUIRED)
- `S3_*` - S3/Spaces configuration (ALL REQUIRED)
- `AUTH_*` - Authentication credentials (REQUIRED)
- `CLOUDFLARE_TUNNEL_TOKEN` - For secure tunnel deployment (optional)

### Application Settings (Database-Stored)

Some settings are stored in the database (not env vars) and configurable via the Settings UI:

- **Max file upload size** - Default 100 MB, configurable from 1 MB to 2 GB

These are stored in the `app_settings` table and managed via `/api/settings` endpoint.

### ⚠️ CRITICAL: No Hardcoded Defaults

**All configuration must come from environment variables.** The `config.ts` file must NOT contain hardcoded defaults for any required values like:

- Database credentials (`POSTGRES_HOST`, `POSTGRES_PASSWORD`, etc.)
- S3 credentials (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, etc.)
- Authentication secrets (`AUTH_PASSWORD`, `AUTH_SESSION_SECRET`)

Only truly optional values with sensible defaults (like `PORT=3000` or `LOG_LEVEL=info`) should have defaults.

### Docker Environment

Docker Compose must read ALL configuration from the `.env` file. Use `env_file` directive:

```yaml
services:
  app:
    env_file:
      - .env
```

Never hardcode sensitive values in `docker-compose.yml`. Use environment variable interpolation: `${VARIABLE_NAME}`

## Common Tasks

### Adding a new UI component

```bash
pnpm dlx shadcn@latest add <component>
```

### Adding a new API route

Create file in `src/pages/api/` following existing patterns. Use middleware from `@/lib/api`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { withMethods, withErrorHandler, Errors, sendError } from "@/lib/api";

export default withErrorHandler(
  withMethods({
    POST: async (req, res) => {
      // Your logic here
    },
  })
);
```

### Adding a new page

Create file in `src/pages/` - filename becomes route.

### Using Configuration

```typescript
import { config } from "@/lib/config";

// Access typed config
if (config.s3.isConfigured) {
  // S3 is ready
}
```

## Gotchas

1. This uses **Pages Router**, not App Router - no "use client" needed
2. react-pdf needs worker configuration in next.config.mjs
3. S3 client is singleton - imported from `@/lib/s3`
4. Book files are NOT stored in database, only metadata
5. Tailwind 4.0 uses `@tailwindcss/postcss` not `tailwindcss`
6. Use `@/lib` barrel exports for cleaner imports

## Testing Locally

### Fastest Way (Docker - Recommended)

```bash
# Copy the example environment (works out of the box!)
cp .env.example .env

# Start everything with one command
docker compose --profile local-storage up -d

# Open http://localhost:3000
# Login: admin / changeme123
```

### Local Development (pnpm dev)

```bash
pnpm install
cp .env.example .env.local

# Start MinIO for local S3
docker compose --profile local-storage up -d

# Run Next.js dev server
pnpm dev
```

## Production Deployment

For secure internet deployment on DigitalOcean or similar:

```bash
# 1. Start with the example file
cp .env.example .env

# 2. Generate secure secrets and update .env
openssl rand -base64 16  # For AUTH_PASSWORD
openssl rand -base64 32  # For AUTH_SESSION_SECRET
openssl rand -base64 24  # For POSTGRES_PASSWORD

# 3. Configure S3 (DigitalOcean Spaces or AWS S3)
# Edit .env: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY

# 4. Add Cloudflare Tunnel token
# Get from: https://one.dash.cloudflare.com → Networks → Tunnels
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJ..." >> .env

# 5. Deploy with tunnel (no ports exposed!)
docker compose --profile tunnel up -d
```

## Security Considerations

- **Never expose ports** - Use Cloudflare Tunnel for internet access
- **Strong passwords** - All auth/db passwords should be randomly generated
- **HTTPS only** - Cloudflare provides SSL termination
- **Security headers** - CSP, HSTS, X-Frame-Options all configured in next.config.mjs
- **SQL injection** - All queries use parameterized statements
- **File validation** - Only PDF/EPUB allowed, size limits enforced
