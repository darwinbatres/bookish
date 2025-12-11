# 📚 Shelf - Personal Book Reader

A minimalist, privacy-focused personal book reader. Upload and read PDFs and EPUBs with bookmarks, notes, reading time tracking, favorites, wishlists, collections, and custom book covers—all stored securely with PostgreSQL and S3-compatible storage.

## ✨ Features

### 📖 Reading Experience

- **PDF & EPUB Reader** - Smooth, responsive reading with zoom and keyboard navigation
- **🔖 Bookmarks** - Save your favorite pages for quick access
- **📝 Notes** - Add notes to any page while reading
- **⏱️ Reading Time** - Automatic tracking of time spent reading each book
- **🎉 Completion Celebration** - Confetti animation when you finish a book!

### 📚 Library Management

- **⭐ Favorites** - Mark your favorite books for quick access
- **📋 Wishlist** - Track books you want to read (with priority levels)
- **📁 Collections** - Organize books into custom groups
- **🖼️ Book Covers** - Upload custom cover images (JPEG, PNG, WebP, GIF)
- **✏️ Edit Book Details** - Rename books, update author, change covers
- **⬇️ Download Books** - Download your books anytime from the library

### 📊 Analytics & Settings

- **📊 Stats Dashboard** - Comprehensive library statistics:
  - Total books, favorites, wishlist items, collections
  - Reading progress: completed books, total reading time, reading sessions
  - Storage: S3 file usage, PostgreSQL database size, format breakdown
  - Recent activity tracking (books, notes, bookmarks, wishlist, collections)
- **⚙️ Configurable Settings** - Adjust max upload size (1MB - 2GB), cover size limits
- **🔐 Security Status** - View authentication, rate limiting, and storage configuration

### 🔐 Security & Infrastructure

- **🔐 Authentication** - Simple username/password auth from environment variables
- **☁️ S3 Storage** - Secure file storage with presigned URLs (DigitalOcean Spaces compatible)
- **🗄️ PostgreSQL** - Reliable metadata storage with no ORM overhead
- **🐳 Docker Ready** - Single `docker compose up` deployment with auto-migrations
- **🔒 Security First** - Security headers, HTTPS support, Cloudflare Tunnel compatibility
- **📱 Mobile-First** - Responsive design that works beautifully on all devices

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose (for containerized deployment)

### Development

```bash
# Clone the repository
git clone https://github.com/yourusername/shelf-book-reader.git
cd shelf-book-reader

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Deployment

The app supports multiple Docker Compose profiles for different deployment scenarios:

| Profile         | Services            | Use Case                                               |
| --------------- | ------------------- | ------------------------------------------------------ |
| _(none)_        | App + PostgreSQL    | Production with external S3 (DigitalOcean Spaces, AWS) |
| `local-storage` | + MinIO             | Local development with S3-compatible storage           |
| `tunnel`        | + Cloudflare Tunnel | Secure internet exposure without open ports            |

#### Basic Deployment (External S3)

Use this when you have DigitalOcean Spaces or AWS S3 configured:

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your S3 credentials

# Build and start containers
docker compose up -d

# View logs
docker compose logs -f
```

#### Local Development (with MinIO)

For local development with S3-compatible storage:

```bash
# Start app + PostgreSQL + MinIO
docker compose --profile local-storage up -d

# MinIO Console: http://localhost:9001
# Default credentials: minioadmin / minioadmin
```

#### Production with Cloudflare Tunnel

For secure internet deployment without exposing ports:

```bash
# Add tunnel token to .env
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJ..." >> .env

# Start app + PostgreSQL + Cloudflare Tunnel
docker compose --profile tunnel up -d
```

#### Local Dev + Tunnel (Testing tunnel locally)

```bash
# Start all services including MinIO and tunnel
docker compose --profile local-storage --profile tunnel up -d
```

#### Useful Commands

```bash
# Stop all containers
docker compose --profile local-storage down

# Stop and remove volumes (fresh start)
docker compose --profile local-storage down -v

# Rebuild after code changes
docker compose --profile local-storage up -d --build

# View logs for specific service
docker compose logs -f app
docker compose logs -f postgres
```

## 🔧 Configuration

### Environment Variables

All required environment variables must be set - **no hardcoded defaults for sensitive values**.

| Variable                   | Description                          | Required | Default                                |
| -------------------------- | ------------------------------------ | -------- | -------------------------------------- |
| **Authentication**         |                                      |          |                                        |
| `AUTH_ENABLED`             | Enable/disable authentication        | No       | `true`                                 |
| `AUTH_USERNAME`            | Login username                       | **Yes**  | -                                      |
| `AUTH_PASSWORD`            | Login password (min 8 chars)         | **Yes**  | -                                      |
| `AUTH_SESSION_SECRET`      | JWT signing secret (min 32 chars)    | **Yes**  | -                                      |
| `AUTH_SESSION_DURATION`    | Session duration in seconds          | No       | `604800` (7 days)                      |
| **Database**               |                                      |          |                                        |
| `POSTGRES_HOST`            | PostgreSQL host                      | **Yes**  | -                                      |
| `POSTGRES_PORT`            | PostgreSQL port                      | **Yes**  | -                                      |
| `POSTGRES_DB`              | Database name                        | **Yes**  | -                                      |
| `POSTGRES_USER`            | Database user                        | **Yes**  | -                                      |
| `POSTGRES_PASSWORD`        | Database password                    | **Yes**  | -                                      |
| `POSTGRES_MAX_CONNECTIONS` | Max connection pool size             | No       | `20`                                   |
| `POSTGRES_SSL_MODE`        | SSL mode (disable/require/verify-ca) | No       | `disable`                              |
| **S3 Storage**             |                                      |          |                                        |
| `S3_ENDPOINT`              | S3/Spaces endpoint (internal)        | **Yes**  | -                                      |
| `S3_PUBLIC_ENDPOINT`       | S3 endpoint for browser access       | No       | _(same as S3_ENDPOINT)_                |
| `S3_REGION`                | AWS region                           | **Yes**  | -                                      |
| `S3_BUCKET`                | Bucket name                          | **Yes**  | -                                      |
| `S3_ACCESS_KEY_ID`         | Access key                           | **Yes**  | -                                      |
| `S3_SECRET_ACCESS_KEY`     | Secret key                           | **Yes**  | -                                      |
| **Uploads**                |                                      |          |                                        |
| `UPLOAD_ALLOWED_TYPES`     | Allowed MIME types (comma-separated) | No       | `application/pdf,application/epub+zip` |
| `PRESIGNED_URL_EXPIRY`     | URL expiry in seconds                | No       | `3600`                                 |
| **Server**                 |                                      |          |                                        |
| `PORT`                     | Server port                          | No       | `3000`                                 |
| `LOG_LEVEL`                | Log level (debug/info/warn/error)    | No       | `info`                                 |
| `LOG_REQUESTS`             | Log HTTP requests                    | No       | `true`                                 |
| **Rate Limiting**          |                                      |          |                                        |
| `RATE_LIMIT_ENABLED`       | Enable API rate limiting             | No       | `false`                                |
| `RATE_LIMIT_RPM`           | Requests per minute limit            | No       | `100`                                  |

> **Note:** Max file upload size is now configured in the **Settings UI** (stored in database). Default: 100 MB, configurable from 1 MB to 2 GB.

### S3 Storage Structure

Files are organized in the S3 bucket as follows:

```plaintext
shelf-books/
├── books/           # Book files (PDF, EPUB)
│   └── {bookId}/
│       └── {timestamp}.{ext}
└── covers/          # Book cover images
    └── {bookId}/
        └── {timestamp}.{ext}
```

### Cover Image Requirements

- **Formats**: JPEG, PNG, WebP, GIF
- **Max Size**: 5 MB
- **Storage**: S3 with presigned URLs (same bucket as books)

### DigitalOcean Spaces Setup

1. Create a Space in your DigitalOcean account
2. Generate Spaces access keys
3. Configure environment:

```env
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_REGION=nyc3
S3_BUCKET=your-space-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

### Authentication Setup

Authentication is **enabled by default**. Configure credentials in your environment:

```env
AUTH_ENABLED=true
AUTH_USERNAME=myusername
AUTH_PASSWORD=mysecurepassword
AUTH_SESSION_SECRET=generate-a-random-32-char-string-here
```

**Generate a secure session secret:**

```bash
openssl rand -base64 32
```

**To disable authentication** (not recommended for public deployments):

```env
AUTH_ENABLED=false
```

When authentication is enabled, users will be redirected to `/login` and must enter the configured username and password.

### Cloudflare Tunnel Deployment

For secure exposure without opening ports on your firewall—perfect for DigitalOcean droplets:

#### Option 1: Docker Compose (Recommended)

```bash
# 1. Create tunnel at https://one.dash.cloudflare.com → Networks → Tunnels
# 2. Copy the tunnel token

# 3. Add to your .env file:
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJ..." >> .env

# 4. Start with tunnel profile:
docker compose --profile tunnel up -d
```

#### Option 2: Standalone cloudflared

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Create and configure tunnel
cloudflared tunnel create shelf
cloudflared tunnel route dns shelf shelf.yourdomain.com

# Run tunnel
cloudflared tunnel run --token YOUR_TOKEN shelf
```

#### Cloudflare Tunnel Setup Steps

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Networks → Tunnels → Create a tunnel**
3. Choose **Cloudflared** connector type
4. Name your tunnel (e.g., "shelf")
5. Copy the token (starts with `eyJ...`)
6. Add public hostname:
   - **Subdomain**: `shelf` (or your choice)
   - **Domain**: `yourdomain.com`
   - **Service**: `http://app:3000` (for Docker) or `http://localhost:3000`
7. Save and deploy

See [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) for more details.

### Production Deployment on DigitalOcean

Complete setup for a secure DigitalOcean deployment:

```bash
# 1. Create droplet (Ubuntu 24.04, 1GB+ RAM recommended)

# 2. SSH into droplet and install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Clone repository
git clone https://github.com/yourusername/shelf-book-reader.git
cd shelf-book-reader

# 4. Create production .env
cp .env.example .env

# 5. Generate secure secrets
echo "AUTH_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "AUTH_SESSION_SECRET=$(openssl rand -base64 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env

# 6. Configure DigitalOcean Spaces
cat >> .env << EOF
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_REGION=nyc3
S3_BUCKET=your-space-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
EOF

# 7. Add Cloudflare tunnel token
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJ..." >> .env

# 8. Deploy with tunnel
docker compose --profile tunnel up -d

# 9. Verify deployment
docker compose logs -f
```

## 📁 Project Structure

```plaintext
shelf-book-reader/
├── src/
│   ├── components/      # React components
│   │   ├── ui/          # shadcn/ui primitives
│   │   ├── library/     # Library view components
│   │   ├── book-cover.tsx      # Cover image component
│   │   ├── edit-book-modal.tsx # Edit book with cover upload
│   │   ├── wishlist-view.tsx   # Wishlist management
│   │   └── *.tsx        # Other feature components
│   ├── hooks/           # Custom React hooks
│   │   ├── use-confetti.ts        # Completion celebration
│   │   ├── use-reading-tracker.ts # Reading session tracking
│   │   └── use-cover-url.ts       # Cover URL resolution
│   ├── lib/             # Utility functions
│   │   ├── api/         # API client + middleware
│   │   ├── db/          # PostgreSQL layer
│   │   │   ├── pool.ts      # Connection pool singleton
│   │   │   ├── schema.sql   # Database schema
│   │   │   ├── migrations/  # Incremental migrations
│   │   │   └── repositories/ # CRUD operations
│   │   ├── auth.ts      # JWT session management
│   │   ├── config.ts    # Centralized configuration
│   │   ├── s3.ts        # S3 operations (books + covers)
│   │   └── utils.ts     # General utilities
│   ├── pages/           # Next.js pages (Pages Router)
│   │   ├── api/         # API routes
│   │   │   ├── auth/    # Authentication endpoints
│   │   │   ├── books/   # Book endpoints + cover upload
│   │   │   ├── collections/ # Collection endpoints
│   │   │   ├── wishlist/    # Wishlist endpoints
│   │   │   ├── settings.ts
│   │   │   ├── stats.ts
│   │   │   └── health.ts
│   │   ├── _app.tsx     # App wrapper
│   │   ├── _document.tsx
│   │   ├── index.tsx    # Main page (Library)
│   │   └── login.tsx    # Login page
│   ├── styles/          # Global styles
│   └── types/           # TypeScript types
│       └── book.ts      # Book-related types
├── public/              # Static assets
├── .github/             # GitHub configs & Copilot instructions
├── docker-compose.yml   # Docker orchestration
├── Dockerfile           # Multi-stage container build
├── docker-entrypoint.sh # Auto-migration entrypoint
└── .env.example         # Environment template
```

## 🔐 Security

This application is designed for **secure internet deployment**:

### Container Security

- **Non-root user** - Docker runs as non-privileged user (UID 1001)
- **Read-only filesystem** - Container filesystem is immutable
- **No new privileges** - Prevents privilege escalation
- **Resource limits** - CPU and memory limits prevent abuse
- **tmpfs for temp files** - Writable areas are memory-only

### Network Security

- **Cloudflare Tunnel** - No open ports required on your server
- **Presigned URLs** - Files are never exposed directly; temporary signed URLs are generated
- **Internal-only database** - PostgreSQL not exposed to internet
- **Internal-only storage** - S3/MinIO not exposed when using tunnel

### Application Security

- **JWT Sessions** - Secure, httpOnly cookies with configurable expiration
- **Environment-based auth** - Credentials stored securely in environment variables (not in database)
- **SameSite cookies** - `lax` policy prevents most CSRF attacks
- **Input validation** - All inputs validated with Zod schemas
- **SQL injection protection** - Parameterized queries throughout
- **XSS prevention** - React's built-in escaping + CSP headers

### Security Headers Applied

| Header                      | Purpose                         |
| --------------------------- | ------------------------------- |
| `Strict-Transport-Security` | Enforces HTTPS (via Cloudflare) |
| `X-Content-Type-Options`    | Prevents MIME sniffing          |
| `X-Frame-Options`           | Prevents clickjacking           |
| `X-XSS-Protection`          | Legacy XSS filter               |
| `Referrer-Policy`           | Controls referrer information   |
| `Permissions-Policy`        | Restricts browser features      |
| `Content-Security-Policy`   | Prevents code injection         |

### Production Security Checklist

Before deploying to the internet:

- [ ] **Strong passwords** - Use `openssl rand -base64 16` for AUTH_PASSWORD
- [ ] **Unique session secret** - Use `openssl rand -base64 32` for AUTH_SESSION_SECRET
- [ ] **Strong DB password** - Use `openssl rand -base64 24` for POSTGRES_PASSWORD
- [ ] **Enable auth** - Set `AUTH_ENABLED=true`
- [ ] **Use Cloudflare Tunnel** - Avoid exposing ports directly
- [ ] **Enable Cloudflare security features**:
  - WAF (Web Application Firewall)
  - Bot protection
  - DDoS protection
  - SSL/TLS encryption (Full strict mode)
- [ ] **Regular updates** - Keep Docker images updated
- [ ] **Monitor logs** - Check `docker compose logs` regularly
- [ ] **Backup database** - Regular PostgreSQL backups

### Firewall Configuration (if not using tunnel)

If you must expose ports directly (not recommended):

```bash
# Ubuntu/Debian with UFW
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 443/tcp     # HTTPS only
sudo ufw enable

# DO NOT expose:
# - Port 3000 (app - use reverse proxy)
# - Port 5432 (PostgreSQL)
# - Port 9000/9001 (MinIO)
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (Pages Router)
- **Language**: TypeScript 5
- **React**: React 19
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **PDF Rendering**: [react-pdf 10](https://github.com/wojtekmaj/react-pdf)
- **EPUB Rendering**: [epub.js](https://github.com/futurepress/epub.js)
- **Validation**: [Zod 4](https://zod.dev/)
- **Authentication**: JWT via [jose](https://github.com/panva/jose)
- **Storage**: AWS S3 / DigitalOcean Spaces
- **Database**: PostgreSQL 16+ (via `pg` - no ORM)
- **Container**: Docker with multi-stage builds
- **Package Manager**: pnpm

## 📝 API Routes

| Endpoint                      | Method | Description                                  |
| ----------------------------- | ------ | -------------------------------------------- |
| `/api/health`                 | GET    | Health check (DB + S3 status)                |
| `/api/stats`                  | GET    | Storage & library stats                      |
| `/api/settings`               | GET    | Get app settings                             |
| `/api/settings`               | PATCH  | Update app settings                          |
| **Authentication**            |        |                                              |
| `/api/auth/login`             | POST   | User login                                   |
| `/api/auth/logout`            | POST   | User logout                                  |
| `/api/auth/me`                | GET    | Check authentication                         |
| **Books**                     |        |                                              |
| `/api/books`                  | GET    | List books (paginated, filterable)           |
| `/api/books`                  | POST   | Create a book                                |
| `/api/books/[id]`             | GET    | Get a book                                   |
| `/api/books/[id]`             | PATCH  | Update book (title, author, cover, favorite) |
| `/api/books/[id]`             | DELETE | Delete a book (+ S3 files)                   |
| `/api/books/upload-url`       | POST   | Get presigned upload URL                     |
| `/api/books/cover-upload-url` | POST   | Get presigned cover upload URL               |
| `/api/books/download-url`     | POST   | Get presigned download URL                   |
| **Bookmarks**                 |        |                                              |
| `/api/books/[id]/bookmarks`   | GET    | Get bookmarks for a book                     |
| `/api/books/[id]/bookmarks`   | POST   | Add a bookmark                               |
| `/api/books/[id]/bookmarks`   | DELETE | Remove a bookmark                            |
| **Notes**                     |        |                                              |
| `/api/books/[id]/notes`       | GET    | Get notes for a book                         |
| `/api/books/[id]/notes`       | POST   | Create a note                                |
| `/api/books/[id]/notes`       | PATCH  | Update a note                                |
| `/api/books/[id]/notes`       | DELETE | Delete a note                                |
| **Reading Sessions**          |        |                                              |
| `/api/books/[id]/sessions`    | GET    | Get active reading session                   |
| `/api/books/[id]/sessions`    | POST   | Start reading session                        |
| `/api/books/[id]/sessions`    | PATCH  | End reading session                          |
| **Collections**               |        |                                              |
| `/api/collections`            | GET    | List all collections                         |
| `/api/collections`            | POST   | Create a collection                          |
| `/api/collections/[id]`       | GET    | Get a collection                             |
| `/api/collections/[id]`       | PATCH  | Update a collection                          |
| `/api/collections/[id]`       | DELETE | Delete a collection                          |
| **Wishlist**                  |        |                                              |
| `/api/wishlist`               | GET    | List wishlist items                          |
| `/api/wishlist`               | POST   | Add to wishlist                              |
| `/api/wishlist/[id]`          | GET    | Get wishlist item                            |
| `/api/wishlist/[id]`          | PATCH  | Update wishlist item                         |
| `/api/wishlist/[id]`          | DELETE | Remove from wishlist                         |

## 🧪 Development

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
```

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

Built with ❤️ for book lovers who value privacy.
