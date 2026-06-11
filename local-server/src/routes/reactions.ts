import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

const REACTION_COLS = `id, upload_id, guest_id, type, created_at`;

interface ReactionRow {
  id: string;
  upload_id: string;
  guest_id: string;
  type: 'heart' | 'laugh' | 'wow';
  created_at: string;
}

const VALID_TYPES = ['heart', 'laugh', 'wow'];

/**
 * GET /api/reactions?uploadId=  or  ?uploadIds=uuid1,uuid2,...
 * Returns reactions for one or multiple uploads.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { uploadId, uploadIds } = req.query as { uploadId?: string; uploadIds?: string };

  if (!uploadId && !uploadIds) {
    res.status(400).json({ error: 'Provide uploadId or uploadIds query parameter' });
    return;
  }

  try {
    if (uploadId) {
      const rows = await query<ReactionRow>(
        `SELECT ${REACTION_COLS} FROM reactions WHERE upload_id = $1`,
        [uploadId]
      );
      res.json(rows);
    } else {
      const ids = (uploadIds as string).split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        res.json([]);
        return;
      }
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const rows = await query<ReactionRow>(
        `SELECT ${REACTION_COLS} FROM reactions WHERE upload_id IN (${placeholders})`,
        ids
      );
      res.json(rows);
    }
  } catch (err) {
    console.error('[Reactions] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

/**
 * POST /api/reactions
 * Body: { id, upload_id, guest_id, type }
 * Toggle reaction: inserts if not exists, deletes if already exists.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { id, upload_id, guest_id, type } = req.body as {
    id?: string;
    upload_id?: string;
    guest_id?: string;
    type?: string;
  };

  if (!id || !upload_id || !guest_id || !type) {
    res.status(400).json({ error: 'Missing required fields: id, upload_id, guest_id, type' });
    return;
  }

  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid reaction type. Must be: heart, laugh, or wow' });
    return;
  }

  try {
    // Verify upload exists and get wedding_id
    const uploadRows = await query<{ wedding_id: string }>(
      'SELECT wedding_id FROM uploads WHERE id = $1',
      [upload_id]
    );

    if (uploadRows.length === 0) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    const wedding_id = uploadRows[0].wedding_id;

    // Verify guest is not banned
    if (guest_id && guest_id !== 'anonymous') {
      const guestRows = await query<{ is_banned: boolean }>(
        'SELECT is_banned FROM guests WHERE id = $1 AND wedding_id = $2',
        [guest_id, wedding_id]
      );
      if (guestRows.length > 0 && guestRows[0].is_banned) {
        res.status(403).json({ error: 'Your account has been banned by the admin.' });
        return;
      }
    }

    // Check if reaction already exists
    const existing = await query<{ id: string }>(
      'SELECT id FROM reactions WHERE upload_id = $1 AND guest_id = $2 AND type = $3',
      [upload_id, guest_id, type]
    );

    if (existing.length > 0) {
      // Toggle off — delete
      await query(
        'DELETE FROM reactions WHERE upload_id = $1 AND guest_id = $2 AND type = $3',
        [upload_id, guest_id, type]
      );
      res.json({ action: 'removed' });
    } else {
      // Toggle on — insert
      const rows = await query<ReactionRow>(
        `INSERT INTO reactions (id, upload_id, guest_id, type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (upload_id, guest_id, type) DO NOTHING
         RETURNING ${REACTION_COLS}`,
        [id, upload_id, guest_id, type]
      );
      res.status(201).json({ action: 'added', reaction: rows[0] || null });
    }
  } catch (err) {
    console.error('[Reactions] POST error:', err);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

export default router;
