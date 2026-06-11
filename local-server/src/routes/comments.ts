import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

const COMMENT_COLS = `id, upload_id, guest_id, guest_name, text, created_at`;

interface CommentRow {
  id: string;
  upload_id: string;
  guest_id: string | null;
  guest_name: string;
  text: string;
  created_at: string;
}

/**
 * GET /api/comments?uploadId=  or  ?uploadIds=uuid1,uuid2,...
 * Returns comments for one or multiple uploads.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { uploadId, uploadIds } = req.query as { uploadId?: string; uploadIds?: string };

  if (!uploadId && !uploadIds) {
    res.status(400).json({ error: 'Provide uploadId or uploadIds query parameter' });
    return;
  }

  try {
    if (uploadId) {
      const rows = await query<CommentRow>(
        `SELECT ${COMMENT_COLS} FROM comments WHERE upload_id = $1 ORDER BY created_at ASC`,
        [uploadId]
      );
      res.json(rows);
    } else {
      // uploadIds is comma-separated UUIDs
      const ids = (uploadIds as string).split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        res.json([]);
        return;
      }
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const rows = await query<CommentRow>(
        `SELECT ${COMMENT_COLS} FROM comments WHERE upload_id IN (${placeholders}) ORDER BY created_at ASC`,
        ids
      );
      res.json(rows);
    }
  } catch (err) {
    console.error('[Comments] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/comments
 * Body: { id, upload_id, guest_id, guest_name, text }
 * Creates a new comment.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { id, upload_id, guest_id, guest_name, text } = req.body as {
    id?: string;
    upload_id?: string;
    guest_id?: string;
    guest_name?: string;
    text?: string;
  };

  if (!id || !upload_id || !guest_name || !text) {
    res.status(400).json({ error: 'Missing required fields: id, upload_id, guest_name, text' });
    return;
  }

  if (text.trim().length === 0) {
    res.status(400).json({ error: 'Comment text cannot be empty' });
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

    const rows = await query<CommentRow>(
      `INSERT INTO comments (id, upload_id, guest_id, guest_name, text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COMMENT_COLS}`,
      [id, upload_id, guest_id || null, guest_name.trim(), text.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Comments] POST error:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

export default router;
