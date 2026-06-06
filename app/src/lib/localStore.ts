import { v4 as uuidv4 } from 'uuid';
import type {
  Wedding,
  Guest,
  Upload,
  Reaction,
  Comment,
  Report,
  GuestSession,
  UploadType,
  Language,
} from './types';

const STORAGE_KEYS = {
  WEDDING: 'vv_wedding',
  GUESTS: 'vv_guests',
  UPLOADS: 'vv_uploads',
  REACTIONS: 'vv_reactions',
  COMMENTS: 'vv_comments',
  REPORTS: 'vv_reports',
  GUEST_SESSION: 'vv_guest_session',
  ADMIN_AUTH: 'vv_admin_auth',
  SETTINGS: 'vv_settings',
  LANGUAGE: 'vowvault_language',
} as const;

// ─── Wedding ───
export function getWedding(): Wedding {
  const raw = localStorage.getItem(STORAGE_KEYS.WEDDING);
  if (raw) return JSON.parse(raw);
  return getDefaultWedding();
}

export function saveWedding(wedding: Wedding): void {
  localStorage.setItem(STORAGE_KEYS.WEDDING, JSON.stringify(wedding));
}

// ─── Guest Session (current logged-in guest) ───
export function getGuestSession(): GuestSession | null {
  const raw = localStorage.getItem(STORAGE_KEYS.GUEST_SESSION);
  return raw ? JSON.parse(raw) : null;
}

export function setGuestSession(session: GuestSession): void {
  localStorage.setItem(STORAGE_KEYS.GUEST_SESSION, JSON.stringify(session));
}

export function clearGuestSession(): void {
  localStorage.removeItem(STORAGE_KEYS.GUEST_SESSION);
}

// ─── Guests ───
export function getGuests(): Guest[] {
  const raw = localStorage.getItem(STORAGE_KEYS.GUESTS);
  return raw ? JSON.parse(raw) : [];
}

export function addGuest(guest: Guest): Guest {
  const guests = getGuests();
  guests.push(guest);
  localStorage.setItem(STORAGE_KEYS.GUESTS, JSON.stringify(guests));
  return guest;
}

// ─── Uploads ───
export function getUploads(): Upload[] {
  const raw = localStorage.getItem(STORAGE_KEYS.UPLOADS);
  return raw ? JSON.parse(raw) : [];
}

export function addUpload(upload: Upload): Upload {
  const uploads = getUploads();
  uploads.unshift(upload);
  localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(uploads));
  return upload;
}

export function updateUpload(id: string, updates: Partial<Upload>): Upload | null {
  const uploads = getUploads();
  const idx = uploads.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  uploads[idx] = { ...uploads[idx], ...updates };
  localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(uploads));
  return uploads[idx];
}

export function deleteUpload(id: string): boolean {
  const uploads = getUploads();
  const filtered = uploads.filter((u) => u.id !== id);
  if (filtered.length === uploads.length) return false;
  localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(filtered));
  return true;
}

// ─── Reactions ───
export function getReactions(): Reaction[] {
  const raw = localStorage.getItem(STORAGE_KEYS.REACTIONS);
  return raw ? JSON.parse(raw) : [];
}

export function addReaction(reaction: Reaction): Reaction {
  const reactions = getReactions();
  reactions.push(reaction);
  localStorage.setItem(STORAGE_KEYS.REACTIONS, JSON.stringify(reactions));
  return reaction;
}

export function removeReaction(uploadId: string, guestId: string, type: string): void {
  const reactions = getReactions();
  const filtered = reactions.filter(
    (r) => !(r.upload_id === uploadId && r.guest_id === guestId && r.type === type)
  );
  localStorage.setItem(STORAGE_KEYS.REACTIONS, JSON.stringify(filtered));
}

export function hasReacted(uploadId: string, guestId: string, type: string): boolean {
  return getReactions().some(
    (r) => r.upload_id === uploadId && r.guest_id === guestId && r.type === type
  );
}

export function getReactionCounts(uploadId: string): Record<string, number> {
  const reactions = getReactions().filter((r) => r.upload_id === uploadId);
  return {
    heart: reactions.filter((r) => r.type === 'heart').length,
    laugh: reactions.filter((r) => r.type === 'laugh').length,
    wow: reactions.filter((r) => r.type === 'wow').length,
  };
}

// ─── Comments ───
export function getComments(): Comment[] {
  const raw = localStorage.getItem(STORAGE_KEYS.COMMENTS);
  return raw ? JSON.parse(raw) : [];
}

export function getCommentsForUpload(uploadId: string): Comment[] {
  return getComments().filter((c) => c.upload_id === uploadId);
}

export function addComment(comment: Comment): Comment {
  const comments = getComments();
  comments.push(comment);
  localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(comments));
  return comment;
}

// ─── Reports ───
export function getReports(): Report[] {
  const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
  return raw ? JSON.parse(raw) : [];
}

export function addReport(report: Report): Report {
  const reports = getReports();
  reports.push(report);
  localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  return report;
}

// ─── Admin ───
export function isAdminAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
}

export function setAdminAuthenticated(value: boolean): void {
  localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, value ? 'true' : 'false');
}

export function getAdminPassword(): string | null {
  return localStorage.getItem('vv_admin_password');
}

export function setAdminPassword(password: string): void {
  localStorage.setItem('vv_admin_password', password);
}

export function clearAdminPassword(): void {
  localStorage.removeItem('vv_admin_password');
}

// ─── Language ───
export function getStoredLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language | null;
  if (saved && (saved === 'tr' || saved === 'en')) return saved;
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('tr')) return 'tr';
  return 'en';
}

export function storeLanguage(lang: Language): void {
  localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
}

// ─── Seed Data ───
function getDefaultWedding(): Wedding {
  return {
    id: 'wedding-demo-001',
    couple_name: 'Açelya & Muhammet',
    bride_name: 'Açelya',
    groom_name: 'Muhammet',
    wedding_date: '2026-06-13',
    venue: 'Bey Garden / Gürpınar',
    slug: 'acelya-muhammet-wedding',
    admin_password_hash: 'admin050505',
    created_at: new Date().toISOString(),
    is_public: true,
    require_guest_name: true,
    allow_comments: true,
    allow_video_uploads: true,
    allow_downloads: true,
    auto_hide_reported: true,
    approve_before_display: false,
    slideshow_approval_mode: false,
    uploads_paused: false,
  };
}

export function seedDemoData(): void {
  // Only seed if not already seeded
  if (localStorage.getItem('vv_seeded') === 'v3') return;

  const wedding = getDefaultWedding();
  saveWedding(wedding);

  const demoGuests: Guest[] = [
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      first_name: 'Demo',
      last_name: 'Misafir 1',
      table_number: '3',
      joined_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      first_name: 'Demo',
      last_name: 'Misafir 2',
      table_number: '5',
      joined_at: new Date(Date.now() - 86400000).toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      first_name: 'Demo',
      last_name: 'Misafir 3',
      table_number: '1',
      joined_at: new Date(Date.now() - 3600000).toISOString(),
      last_seen_at: new Date().toISOString(),
    },
  ];
  localStorage.setItem(STORAGE_KEYS.GUESTS, JSON.stringify(demoGuests));

  const demoUploads: Upload[] = [
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[0].id,
      guest_name: 'Demo Misafir 1',
      type: 'photo' as UploadType,
      local_url: '/gallery-1.jpg',
      caption: 'Masalar muhtesem hazirlanmis!',
      is_approved: true,
      is_hidden: false,
      is_featured: true,
      report_count: 0,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[1].id,
      guest_name: 'Demo Misafir 2',
      type: 'photo' as UploadType,
      local_url: '/gallery-2.jpg',
      caption: 'En guzel cift! Mutluluklar dilerim.',
      is_approved: true,
      is_hidden: false,
      is_featured: false,
      report_count: 0,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[2].id,
      guest_name: 'Demo Misafir 3',
      type: 'message' as UploadType,
      message_text: 'Hayatinizin en guzel gununde yaninizda olmak bir onur. Sonsuz mutluluklar!',
      is_approved: true,
      is_hidden: false,
      is_featured: true,
      report_count: 0,
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[0].id,
      guest_name: 'Demo Misafir 1',
      type: 'photo' as UploadType,
      local_url: '/gallery-3.jpg',
      caption: 'Cicekler harika secilmis!',
      is_approved: true,
      is_hidden: false,
      is_featured: false,
      report_count: 0,
      created_at: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[1].id,
      guest_name: 'Demo Misafir 2',
      type: 'photo' as UploadType,
      local_url: '/gallery-4.jpg',
      caption: 'Pastaya bayildim!',
      is_approved: true,
      is_hidden: false,
      is_featured: false,
      report_count: 0,
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[2].id,
      guest_name: 'Demo Misafir 3',
      type: 'photo' as UploadType,
      local_url: '/gallery-5.jpg',
      caption: 'Dans eden ciftler harika!',
      is_approved: true,
      is_hidden: false,
      is_featured: false,
      report_count: 0,
      created_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: uuidv4(),
      wedding_id: wedding.id,
      guest_id: demoGuests[0].id,
      guest_name: 'Demo Misafir 1',
      type: 'photo' as UploadType,
      local_url: '/gallery-6.jpg',
      caption: 'Gelinlik detaylari muhtesem.',
      is_approved: true,
      is_hidden: false,
      is_featured: false,
      report_count: 0,
      created_at: new Date(Date.now() - 120000).toISOString(),
    },
  ];
  localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(demoUploads));

  const demoReactions: Reaction[] = [
    { id: uuidv4(), upload_id: demoUploads[0].id, guest_id: demoGuests[1].id, type: 'heart', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[0].id, guest_id: demoGuests[2].id, type: 'heart', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[0].id, guest_id: demoGuests[1].id, type: 'wow', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[1].id, guest_id: demoGuests[0].id, type: 'heart', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[1].id, guest_id: demoGuests[2].id, type: 'laugh', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[2].id, guest_id: demoGuests[0].id, type: 'heart', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[2].id, guest_id: demoGuests[1].id, type: 'heart', created_at: new Date().toISOString() },
    { id: uuidv4(), upload_id: demoUploads[3].id, guest_id: demoGuests[2].id, type: 'wow', created_at: new Date().toISOString() },
  ];
  localStorage.setItem(STORAGE_KEYS.REACTIONS, JSON.stringify(demoReactions));

  const demoComments: Comment[] = [
    {
      id: uuidv4(),
      upload_id: demoUploads[0].id,
      guest_id: demoGuests[1].id,
      guest_name: 'Demo Misafir 2',
      text: 'Gercekten cok guzel gorunuyor!',
      created_at: new Date(Date.now() - 6000000).toISOString(),
    },
    {
      id: uuidv4(),
      upload_id: demoUploads[0].id,
      guest_id: demoGuests[2].id,
      guest_name: 'Demo Misafir 3',
      text: 'Bu masada oturuyordum, harikaydi!',
      created_at: new Date(Date.now() - 3000000).toISOString(),
    },
  ];
  localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(demoComments));

  localStorage.setItem('vv_seeded', 'v3');
}

export function resetAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
  localStorage.removeItem('vv_seeded');
  seedDemoData();
}
