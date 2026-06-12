-- ─────────────────────────────────────────────────────────────────────────────
-- VowVault Local PostgreSQL Schema — Plan B
-- Run this once to set up your local database.
-- Compatible with: PostgreSQL 14+
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure vowvault has permissions on public schema
GRANT ALL ON SCHEMA public TO vowvault;

-- Enable required extension (pgcrypto provides gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. WEDDINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weddings (
  id                     TEXT PRIMARY KEY,
  couple_name            TEXT NOT NULL,
  bride_name             TEXT NOT NULL,
  groom_name             TEXT NOT NULL,
  wedding_date           DATE NOT NULL,
  venue                  TEXT NOT NULL,
  slug                   TEXT UNIQUE NOT NULL,
  admin_password_hash    TEXT NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  is_public              BOOLEAN DEFAULT TRUE,
  require_guest_name     BOOLEAN DEFAULT TRUE,
  allow_comments         BOOLEAN DEFAULT TRUE,
  allow_video_uploads    BOOLEAN DEFAULT TRUE,
  allow_downloads        BOOLEAN DEFAULT TRUE,
  auto_hide_reported     BOOLEAN DEFAULT TRUE,
  approve_before_display BOOLEAN DEFAULT FALSE,
  slideshow_approval_mode BOOLEAN DEFAULT FALSE,
  uploads_paused         BOOLEAN DEFAULT FALSE,
  allow_guest_change_name BOOLEAN DEFAULT TRUE,
  max_photos_per_guest   INTEGER DEFAULT 50,
  max_videos_per_guest   INTEGER DEFAULT 10,
  max_messages_per_guest INTEGER DEFAULT 5,
  max_guestbook_signatures_per_guest INTEGER DEFAULT 5,
  hero_photo             TEXT NULL,
  couple_photo           TEXT NULL,
  gallery_banner         TEXT NULL,
  thank_you_quote        TEXT NULL,
  upload_placeholder_image TEXT NULL
);

-- ─── 2. GUESTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  table_number TEXT NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_banned    BOOLEAN DEFAULT FALSE
);

-- ─── 3. UPLOADS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id       TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  guest_id         UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name       TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('photo', 'video', 'message', 'guestbook')),
  local_url        TEXT NULL,
  storage_path     TEXT NULL,
  public_url       TEXT NULL,
  thumbnail_url    TEXT NULL,
  caption          TEXT NULL,
  message_text     TEXT NULL,
  drawing_data_url TEXT NULL,
  is_approved      BOOLEAN DEFAULT TRUE,
  is_hidden        BOOLEAN DEFAULT FALSE,
  is_featured      BOOLEAN DEFAULT FALSE,
  report_count     INTEGER DEFAULT 0,
  file_size        INTEGER NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. REACTIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id  UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  guest_id   UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('heart', 'laugh', 'wow')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (upload_id, guest_id, type)
);

-- ─── 5. COMMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id  UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  guest_id   UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
-- weddings
CREATE INDEX IF NOT EXISTS idx_weddings_id   ON weddings(id);
CREATE INDEX IF NOT EXISTS idx_weddings_slug ON weddings(slug);

-- guests
CREATE INDEX IF NOT EXISTS idx_guests_wedding_id ON guests(wedding_id);
CREATE INDEX IF NOT EXISTS idx_guests_id         ON guests(id);

-- uploads (single column)
CREATE INDEX IF NOT EXISTS idx_uploads_wedding_id ON uploads(wedding_id);
CREATE INDEX IF NOT EXISTS idx_uploads_guest_id   ON uploads(guest_id);
CREATE INDEX IF NOT EXISTS idx_uploads_type       ON uploads(type);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at);

-- uploads (composite — critical for gallery queries)
CREATE INDEX IF NOT EXISTS idx_uploads_wedding_type
  ON uploads(wedding_id, type);

CREATE INDEX IF NOT EXISTS idx_uploads_wedding_hidden_approved_created
  ON uploads(wedding_id, is_hidden, is_approved, created_at);

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_upload_id  ON comments(upload_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- reactions
CREATE INDEX IF NOT EXISTS idx_reactions_upload_id           ON reactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_reactions_guest_id            ON reactions(guest_id);
CREATE INDEX IF NOT EXISTS idx_reactions_upload_guest_type   ON reactions(upload_id, guest_id, type);

-- ─── SEED DATA ───────────────────────────────────────────────────────────────
-- Insert the demo wedding. Matches the local-first seed in localStore.ts.
INSERT INTO weddings (
  id, couple_name, bride_name, groom_name, wedding_date, venue,
  slug, admin_password_hash,
  is_public, require_guest_name, allow_comments, allow_video_uploads,
  allow_downloads, auto_hide_reported, approve_before_display,
  slideshow_approval_mode, uploads_paused,
  allow_guest_change_name, max_photos_per_guest, max_videos_per_guest
) VALUES (
  'wedding-demo-001',
  'Açelya & Muhammet',
  'Açelya',
  'Muhammet',
  '2026-06-13',
  'Bey Garden / Gürpınar',
  'acelya-muhammet-wedding',
  'admin050505',
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE,
  TRUE, 50, 10
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Schema complete.
-- To verify: \dt  (list tables)  |  \di  (list indexes)
-- ─────────────────────────────────────────────────────────────────────────────
