import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';
import { buildSetClause, SAFE_WEDDING_COLUMNS } from '../middleware/validate';

const router = Router();

// ─── Columns returned to frontend (never include admin_password_hash) ─────────
const WEDDING_PUBLIC_COLS = `
  id, couple_name, bride_name, groom_name, wedding_date, venue, slug,
  created_at, is_public, require_guest_name, allow_comments,
  allow_video_uploads, allow_downloads, auto_hide_reported,
  approve_before_display, slideshow_approval_mode, uploads_paused,
  hero_photo, couple_photo, gallery_banner, thank_you_quote,
  upload_placeholder_image, allow_guest_change_name, max_photos_per_guest,
  max_videos_per_guest
`.trim();

interface WeddingRow {
  id: string;
  couple_name: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string;
  venue: string;
  slug: string;
  admin_password_hash?: string;
  [key: string]: unknown;
}

/**
 * GET /api/wedding
 * Query: ?slug=acelya-muhammet-wedding  OR  ?weddingId=wedding-demo-001
 * Returns public wedding data (no password hash).
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { slug, weddingId } = req.query as { slug?: string; weddingId?: string };

  if (!slug && !weddingId) {
    res.status(400).json({ error: 'Provide slug or weddingId query parameter' });
    return;
  }

  try {
    let rows: WeddingRow[];

    if (slug) {
      rows = await query<WeddingRow>(
        `SELECT ${WEDDING_PUBLIC_COLS} FROM weddings WHERE slug = $1`,
        [slug]
      );
    } else {
      rows = await query<WeddingRow>(
        `SELECT ${WEDDING_PUBLIC_COLS} FROM weddings WHERE id = $1`,
        [weddingId]
      );
    }

    if (rows.length === 0) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[Wedding] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch wedding' });
  }
});

/**
 * POST /api/update-settings
 * Body: { weddingId, adminPassword, updates }
 * Requires admin auth. Updates safe wedding columns only.
 */
router.post('/update-settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { weddingId, updates } = req.body as {
    weddingId: string;
    updates: Record<string, unknown>;
  };

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    res.status(400).json({ error: 'updates must be a plain object' });
    return;
  }

  try {
    const { clause, values, nextIndex } = buildSetClause(updates, SAFE_WEDDING_COLUMNS, 2);

    if (!clause) {
      res.status(400).json({ error: 'No valid update fields provided' });
      return;
    }

    const rows = await query<WeddingRow>(
      `UPDATE weddings SET ${clause} WHERE id = $1
       RETURNING ${WEDDING_PUBLIC_COLS}`,
      [weddingId, ...values]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    res.json({ success: true, wedding: rows[0] });
  } catch (err) {
    console.error('[Wedding] update-settings error:', err);
    res.status(500).json({ error: 'Failed to update wedding settings' });
  }
});

export default router;
