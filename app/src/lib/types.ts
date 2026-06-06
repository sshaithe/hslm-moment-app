export interface Wedding {
  id: string;
  couple_name: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string;
  venue: string;
  slug: string;
  admin_password_hash: string;
  created_at: string;
  is_public: boolean;
  require_guest_name: boolean;
  allow_comments: boolean;
  allow_video_uploads: boolean;
  allow_downloads: boolean;
  auto_hide_reported: boolean;
  approve_before_display: boolean;
  slideshow_approval_mode: boolean;
  uploads_paused: boolean;
  hero_photo?: string;      // base64 or URL for the landing page hero background
  couple_photo?: string;    // base64 or URL for the couple portrait on the landing page
  gallery_banner?: string;  // base64 or URL for the gallery screen header
  thank_you_quote?: string; // custom thank you/welcome quote shown on the landing page
}

export interface Guest {
  id: string;
  wedding_id: string;
  first_name: string;
  last_name: string;
  table_number?: string;
  joined_at: string;
  last_seen_at: string;
}

export type UploadType = 'photo' | 'video' | 'message';

export interface Upload {
  id: string;
  wedding_id: string;
  guest_id: string;
  guest_name: string;
  type: UploadType;
  local_url?: string;
  storage_path?: string;
  public_url?: string;
  caption?: string;
  message_text?: string;
  is_approved: boolean;
  is_hidden: boolean;
  is_featured: boolean;
  report_count: number;
  created_at: string;
}

export interface Reaction {
  id: string;
  upload_id: string;
  guest_id: string;
  type: 'heart' | 'laugh' | 'wow';
  created_at: string;
}

export interface Comment {
  id: string;
  upload_id: string;
  guest_id: string;
  guest_name: string;
  text: string;
  created_at: string;
}

export interface Report {
  id: string;
  upload_id: string;
  guest_id?: string;
  reason?: string;
  created_at: string;
}

export interface GuestSession {
  guest_id: string;
  first_name: string;
  last_name: string;
  wedding_id: string;
}

export type Language = 'tr' | 'en';

export type GalleryTab = 'all' | 'photos' | 'videos' | 'messages' | 'popular';

export type AdminNavItem = 'dashboard' | 'uploads' | 'gallery' | 'qrcode' | 'slideshow' | 'settings';

export interface AppState {
  wedding: Wedding;
  currentGuest: GuestSession | null;
  isAdmin: boolean;
  uploads: Upload[];
  reactions: Reaction[];
  comments: Comment[];
  reports: Report[];
  guests: Guest[];
  language: Language;
}
