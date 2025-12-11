# Contributing to Shelf Book Reader

First off, thank you for considering contributing to Shelf Book Reader! It's people like you that make this project better.

## Code of Conduct

By participating in this project, you are expected to uphold our values of respect, inclusivity, and constructive collaboration.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When reporting bugs, include:**

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots if applicable
- Your environment (OS, browser, Node.js version)

### Suggesting Features

Feature suggestions are welcome! Please:

- Check if the feature already exists or has been requested
- Provide a clear use case
- Describe the expected behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/shelf-book-reader.git
cd shelf-book-reader

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server (database + app)
docker compose up postgres -d  # Start database
pnpm dev                       # Start app

# Or use full Docker setup with MinIO
docker compose --profile local-storage up -d
```

## Project Architecture

### Tech Stack

- **Framework**: Next.js 16 (Pages Router)
- **Language**: TypeScript 5.x (strict mode)
- **React**: React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL 16+ (raw `pg`, no ORM)
- **Storage**: S3-compatible (AWS/DigitalOcean Spaces/MinIO)
- **Auth**: JWT sessions via `jose`

### Key Directories

```
src/
├── components/     # React components (shadcn/ui primitives in ui/)
├── hooks/          # Custom React hooks
├── lib/            # Utilities, API client, database layer
├── pages/          # Next.js pages and API routes
├── styles/         # Global CSS
└── types/          # TypeScript type definitions
```

## Coding Standards

### TypeScript

- Use strict mode
- Prefer interfaces over types for objects
- Export types from `src/types/`
- Use Zod for runtime validation

### Components

- Functional components with hooks
- Props interface named `ComponentNameProps`
- Use `cn()` for conditional classes

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Pages: `kebab-case.tsx`

### Imports Order

1. External packages
2. Internal modules (`@/`)
3. Relative imports
4. Type imports

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DBBook } from "@/types";
```

### API Routes

Use the middleware pattern from `@/lib/api`:

```typescript
import { withAuth, withMethods, withErrorHandler } from "@/lib/api";

async function handler(req, res) {
  // Your logic
}

export default withAuth(withErrorHandler(withMethods({ GET: handler })));
```

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `style:` formatting
- `refactor:` code restructuring
- `test:` adding tests
- `chore:` maintenance

## Testing

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Build test
pnpm build
```

## Security Guidelines

- Never commit secrets or credentials
- Use environment variables for all sensitive config
- Validate all user input with Zod
- Use parameterized queries (the repository layer handles this)
- All API routes should use `withAuth` middleware

## Questions?

Open an issue with the `question` label or start a discussion.

Thank you for contributing!
