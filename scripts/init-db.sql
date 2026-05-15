-- SVA Platform — PostgreSQL initialization
-- Creates extensions needed by Prisma + the app

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- fast full-text search
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- accent-insensitive search
