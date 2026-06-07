-- Supabase SQL Schema for HSLM Moment App
-- Copy and run this script inside your Supabase project's SQL Editor

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ─── 1. WEDDING SETTINGS ───
create table if not exists public.weddings (
    id text primary key,
    couple_name text not null,
    bride_name text not null,
    groom_name text not null,
    wedding_date date not null,
    venue text not null,
    slug text unique not null,
    admin_password_hash text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    is_public boolean default true not null,
    require_guest_name boolean default true not null,
    allow_comments boolean default true not null,
    allow_video_uploads boolean default true not null,
    allow_downloads boolean default true not null,
    auto_hide_reported boolean default true not null,
    approve_before_display boolean default false not null,
    slideshow_approval_mode boolean default false not null,
    uploads_paused boolean default false not null,
    hero_photo text,          -- Base64 or public storage URL
    couple_photo text,        -- Base64 or public storage URL
    gallery_banner text,      -- Base64 or public storage URL
    thank_you_quote text      -- Custom thank you quote
);

-- ─── 2. GUESTS ───
create table if not exists public.guests (
    id uuid default gen_random_uuid() primary key,
    wedding_id text references public.weddings(id) on delete cascade not null,
    first_name text not null,
    last_name text not null,
    table_number text,
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_seen_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ─── 3. UPLOADS ───
create table if not exists public.uploads (
    id uuid default gen_random_uuid() primary key,
    wedding_id text references public.weddings(id) on delete cascade not null,
    guest_id uuid references public.guests(id) on delete set null,
    guest_name text not null,
    type text check (type in ('photo', 'video', 'message')) not null,
    local_url text, -- blob URL fallback
    storage_path text, -- file storage path in bucket
    public_url text, -- live file URL
    caption text,
    message_text text,
    is_approved boolean default true not null,
    is_hidden boolean default false not null,
    is_featured boolean default false not null,
    report_count integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ─── 4. REACTIONS ───
create table if not exists public.reactions (
    id uuid default gen_random_uuid() primary key,
    upload_id uuid references public.uploads(id) on delete cascade not null,
    guest_id uuid references public.guests(id) on delete cascade not null,
    type text check (type in ('heart', 'laugh', 'wow')) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(upload_id, guest_id, type)
);

-- ─── 5. COMMENTS ───
create table if not exists public.comments (
    id uuid default gen_random_uuid() primary key,
    upload_id uuid references public.uploads(id) on delete cascade not null,
    guest_id uuid references public.guests(id) on delete set null,
    guest_name text not null,
    text text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ─── 6. STORAGE BUCKET FOR PHOTOS/VIDEOS ───
-- In Supabase, files are stored in buckets. We will store uploaded images/videos here.
-- Note: Make sure to create a public bucket named "gallery" in your Supabase dashboard.

-- ─── 7. ROW LEVEL SECURITY (RLS) POLICIES ───
-- Turn on RLS for safety
alter table public.weddings enable row level security;
alter table public.guests enable row level security;
alter table public.uploads enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;

-- Create secure policies for weddings (Read-only for public, update is done via admin API)
create policy "Allow public read of weddings" on public.weddings for select using (true);

-- guests policies (Allow read, insert, update)
create policy "Allow public read of guests" on public.guests for select using (true);
create policy "Allow public insert of guests" on public.guests for insert with check (true);
create policy "Allow public update of guests" on public.guests for update using (true);

-- uploads policies (Allow read and guest uploads; disable public deletions)
create policy "Allow public read of uploads" on public.uploads for select using (true);
create policy "Allow public insert of uploads" on public.uploads for insert with check (
  -- If moderation is required, guest uploads must be created as unapproved
  (is_approved = false) OR 
  (is_approved = true AND (select approve_before_display from public.weddings where id = wedding_id) = false)
);
create policy "Allow public update of uploads" on public.uploads for update using (true); -- allowed for reporting updates

-- reactions policies (Allow read, insert, delete)
create policy "Allow public read of reactions" on public.reactions for select using (true);
create policy "Allow public insert of reactions" on public.reactions for insert with check (true);
create policy "Allow public delete of reactions" on public.reactions for delete using (true);

-- comments policies (Allow read and write, disable public deletes)
create policy "Allow public read of comments" on public.comments for select using (true);
create policy "Allow public insert of comments" on public.comments for insert with check (true);

-- ─── 8. DEFAULT SEED DATA ───
-- Insert the default wedding demo project settings
insert into public.weddings (
    id, couple_name, bride_name, groom_name, wedding_date, venue, slug, admin_password_hash, 
    is_public, require_guest_name, allow_comments, allow_video_uploads, allow_downloads, 
    auto_hide_reported, approve_before_display, slideshow_approval_mode, uploads_paused
) values (
    'wedding-demo-001', 'Açelya & Muhammet', 'Açelya', 'Muhammet', '2026-06-13', 'Bey Garden / Gürpınar', 
    'acelya-muhammet-wedding', 'admin050505', true, true, true, true, true, true, false, false, false
) on conflict (id) do nothing;
