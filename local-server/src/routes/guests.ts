import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';
import {
  buildSetClause,
  SAFE_GUEST_COLUMNS,
  parsePagination,
} from '../middleware/validate';

const router = Router();

const GUEST_COLS = `
  id, wedding_id, first_name, last_name, table_number,
  joined_at, last_seen_at, is_banned
`.trim();

interface GuestRow {
  id: string;
  wedding_id: string;
  first_name: string;
  last_name: string;
  table_number: string | null;
  joined_at: string;
  last_seen_at: string;
  is_banned: boolean;
}

/**
 * GET /api/guests?weddingId=
 * Returns all non-banned guests for a wedding.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { weddingId } = req.query as { weddingId?: string };

  if (!weddingId) {
    res.status(400).json({ error: 'Missing weddingId query parameter' });
    return;
  }

  try {
    const rows = await query<GuestRow>(
      `SELECT ${GUEST_COLS} FROM guests WHERE wedding_id = $1 ORDER BY joined_at ASC`,
      [weddingId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Guests] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

/**
 * POST /api/guests
 * Body: { id, wedding_id, first_name, last_name, table_number? }
 * Registers a new guest. Uses upsert to handle re-registration gracefully.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { id, wedding_id, first_name, last_name, table_number } = req.body as {
    id?: string;
    wedding_id?: string;
    first_name?: string;
    last_name?: string;
    table_number?: string;
  };

  if (!id || !wedding_id || !first_name || !last_name) {
    res.status(400).json({ error: 'Missing required fields: id, wedding_id, first_name, last_name' });
    return;
  }

  try {
    const rows = await query<GuestRow>(
      `INSERT INTO guests (id, wedding_id, first_name, last_name, table_number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET last_seen_at = NOW(), first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
       RETURNING ${GUEST_COLS}`,
      [id, wedding_id, first_name.trim(), last_name.trim(), table_number || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Guests] POST error:', err);
    res.status(500).json({ error: 'Failed to register guest' });
  }
});

/**
 * POST /api/update-guest
 * Body: { guestId, weddingId, adminPassword, updates }
 * Admin: update guest fields (is_banned, first_name, last_name, table_number).
 */
router.post('/update-guest', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guestId, weddingId, updates } = req.body as {
    guestId?: string;
    weddingId: string;
    updates: Record<string, unknown>;
  };

  if (!guestId) {
    res.status(400).json({ error: 'Missing guestId' });
    return;
  }

  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'updates must be a plain object' });
    return;
  }

  try {
    const { clause, values } = buildSetClause(updates, SAFE_GUEST_COLUMNS, 3);

    if (!clause) {
      res.status(400).json({ error: 'No valid update fields provided' });
      return;
    }

    // Verify guest belongs to wedding
    const rows = await query<GuestRow>(
      `UPDATE guests SET ${clause} WHERE id = $1 AND wedding_id = $2
       RETURNING ${GUEST_COLS}`,
      [guestId, weddingId, ...values]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Guest not found in this wedding' });
      return;
    }

    res.json({ success: true, guest: rows[0] });
  } catch (err) {
    console.error('[Guests] update-guest error:', err);
    res.status(500).json({ error: 'Failed to update guest' });
  }
});

/**
 * GET /api/admin/guests?weddingId=&adminPassword=
 * Admin: returns ALL guests including banned.
 */
router.get('/admin', async (req: Request, res: Response): Promise<void> => {
  const { weddingId, adminPassword } = req.query as {
    weddingId?: string;
    adminPassword?: string;
  };

  if (!weddingId || !adminPassword) {
    res.status(400).json({ error: 'Missing weddingId or adminPassword' });
    return;
  }

  // Inline auth for GET query param style
  try {
    const { verifyAdminPassword } = await import('../middleware/auth');
    const { valid, weddingExists } = await verifyAdminPassword(weddingId, adminPassword);

    if (!weddingExists) { res.status(404).json({ error: 'Wedding not found' }); return; }
    if (!valid) { res.status(401).json({ error: 'Invalid admin password' }); return; }

    const rows = await query<GuestRow>(
      `SELECT ${GUEST_COLS} FROM guests WHERE wedding_id = $1 ORDER BY joined_at DESC`,
      [weddingId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Guests] admin GET error:', err);
    res.status(500).json({ error: 'Failed to fetch admin guests' });
  }
});

export default router;
