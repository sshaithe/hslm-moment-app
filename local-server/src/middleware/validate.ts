import { Request, Response } from 'express';

// ─── Type guard helpers ───────────────────────────────────────────────────────

export function isString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isUUID(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

// ─── Parse and clamp pagination params ───────────────────────────────────────
export function parsePagination(
  query: Record<string, string | string[] | undefined>,
  maxLimit = 10000
): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(1, parseInt((query.limit as string) || '5000', 10) || 5000),
    maxLimit
  );
  const offset = Math.max(0, parseInt((query.offset as string) || '0', 10) || 0);
  return { limit, offset };
}

// ─── Send a standardised 400 error ───────────────────────────────────────────
export function badRequest(res: Response, message: string): void {
  res.status(400).json({ error: message });
}

// ─── Allowed columns for safe UPDATE operations ───────────────────────────────

export const SAFE_WEDDING_COLUMNS = new Set([
  'couple_name', 'bride_name', 'groom_name', 'wedding_date', 'venue',
  'is_public', 'require_guest_name', 'allow_comments', 'allow_video_uploads',
  'allow_downloads', 'auto_hide_reported', 'approve_before_display',
  'slideshow_approval_mode', 'uploads_paused',
  'allow_guest_change_name', 'max_photos_per_guest', 'max_videos_per_guest',
  'max_messages_per_guest', 'max_guestbook_signatures_per_guest',
  'hero_photo', 'couple_photo', 'gallery_banner',
  'thank_you_quote', 'upload_placeholder_image',
]);

export const SAFE_UPLOAD_COLUMNS = new Set([
  'is_approved', 'is_hidden', 'is_featured', 'report_count',
  'caption', 'message_text', 'thumbnail_url',
]);

export const SAFE_GUEST_COLUMNS = new Set([
  'is_banned', 'first_name', 'last_name', 'table_number', 'last_seen_at',
]);

// ─── Build a SET clause for parameterized UPDATE ──────────────────────────────
// Returns: { clause: "col1=$2,col2=$3", values: [val1, val2], nextIndex: 4 }
export function buildSetClause(
  updates: Record<string, unknown>,
  allowedColumns: Set<string>,
  startIndex = 2
): { clause: string; values: unknown[]; nextIndex: number } {
  const parts: string[] = [];
  const values: unknown[] = [];
  let idx = startIndex;

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedColumns.has(key)) continue; // silently skip disallowed fields
    parts.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  return { clause: parts.join(', '), values, nextIndex: idx };
}

// ─── Validate request body fields ────────────────────────────────────────────
export function requireFields(
  req: Request,
  res: Response,
  fields: string[]
): boolean {
  const missing = fields.filter((f) => {
    const v = (req.body as Record<string, unknown>)[f];
    return v === undefined || v === null || v === '';
  });

  if (missing.length > 0) {
    res.status(400).json({
      error: `Missing required fields: ${missing.join(', ')}`,
    });
    return false;
  }
  return true;
}
