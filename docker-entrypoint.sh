#!/bin/sh
set -e

echo "[Bookish] Starting application..."

# Run database migrations if POSTGRES_HOST is set
if [ -n "$POSTGRES_HOST" ]; then
    echo "[Bookish] Running database migrations..."
    
    # Wait for PostgreSQL to be ready
    max_attempts=30
    attempt=0
    until PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo "[Bookish] Warning: Could not connect to database after $max_attempts attempts, starting anyway..."
            break
        fi
        echo "[Bookish] Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 1
    done
    
    # Run the migration SQL if database is available
    if [ $attempt -lt $max_attempts ]; then
        # Run idempotent migrations
        for migration in /app/migrations/*.sql; do
            if [ -f "$migration" ]; then
                echo "[Bookish] Running migration: $(basename $migration)"
                PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration" 2>&1 || true
            fi
        done
        echo "[Bookish] Migrations complete"
    fi
fi

echo "[Bookish] Starting Next.js server..."
exec node server.js
