import { Router, Request, Response } from 'express';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db';
import { requireAdmin } from '../middleware/auth';
import { buildSetClause, SAFE_UPLOAD_COLUMNS, parsePagination } from '../middleware/validate';
import { verifyAdminPassword } from '../middleware/auth';

const router = Router();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || '',
    secretAccessKey: process.env.B2_APPLICATION_KEY || '',
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const UPLOAD_COLS = `
  id, wedding_id, guest_id, guest_name, type,
  storage_path, public_url, thumbnail_url, caption, message_text, drawing_data_url,
  is_approved, is_hidden, is_featured, report_count, file_size, created_at
`.trim();

interface UploadRow {
  id: string;
  wedding_id: string;
  guest_id: string | null;
  guest_name: string;
  type: string;
  storage_path: string | null;
  public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  message_text: string | null;
  drawing_data_url: string | null;
  is_approved: boolean;
  is_hidden: boolean;
  is_featured: boolean;
  report_count: number;
  file_size: number | null;
  created_at: string;
}

/**
 * GET /api/uploads?weddingId=&type=&limit=&offset=
 * Returns public (non-hidden, approved if required) uploads.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { weddingId, type } = req.query as { weddingId?: string; type?: string };

  if (!weddingId) {
    res.status(400).json({ error: 'Missing weddingId query parameter' });
    return;
  }

  const { limit, offset } = parsePagination(req.query as Record<string, string>);

  try {
    const params: unknown[] = [weddingId];
    let typeFilter = '';

    if (type && ['photo', 'video', 'message', 'guestbook'].includes(type)) {
      typeFilter = ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    const rows = await query<UploadRow>(
      `SELECT ${UPLOAD_COLS}
       FROM uploads
       WHERE wedding_id = $1
         AND is_hidden = FALSE${typeFilter}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    console.error('[Uploads] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

/**
 * POST /api/uploads/metadata
 * Body: upload row (without created_at)
 * Creates an upload metadata entry in the database.
 * The actual file has already been uploaded directly to Backblaze.
 */
router.post('/metadata', async (req: Request, res: Response): Promise<void> => {
  const {
    id, wedding_id, guest_id, guest_name, type,
    storage_path, public_url, thumbnail_url, caption, message_text,
    drawing_data_url, is_approved, file_size,
  } = req.body as Partial<UploadRow>;

  if (!id || !wedding_id || !guest_name || !type) {
    res.status(400).json({ error: 'Missing required fields: id, wedding_id, guest_name, type' });
    return;
  }

  const validTypes = ['photo', 'video', 'message', 'guestbook'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  try {
    // Verify wedding exists and uploads are not paused
    const weddingRows = await query<{ uploads_paused: boolean; require_guest_name: boolean }>(
      'SELECT uploads_paused, require_guest_name FROM weddings WHERE id = $1',
      [wedding_id]
    );

    if (weddingRows.length === 0) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    if (weddingRows[0].uploads_paused) {
      res.status(403).json({ error: 'Uploads are paused by the admin.' });
      return;
    }

    if (weddingRows[0].require_guest_name && (!guest_id || guest_id === 'anonymous')) {
      res.status(403).json({ error: 'Guest registration is required before uploading.' });
      return;
    }

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

    const rows = await query<UploadRow>(
      `INSERT INTO uploads (
         id, wedding_id, guest_id, guest_name, type,
         storage_path, public_url, thumbnail_url, caption, message_text,
         drawing_data_url, is_approved, file_size
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING ${UPLOAD_COLS}`,
      [
        id, wedding_id,
        guest_id && guest_id !== 'anonymous' ? guest_id : null,
        guest_name, type,
        storage_path || null, public_url || null, thumbnail_url || null, caption || null,
        message_text || null, drawing_data_url || null,
        is_approved !== false, // default true unless explicitly false
        file_size || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Uploads] POST metadata error:', err);
    res.status(500).json({ error: 'Failed to save upload metadata' });
  }
});

/**
 * PATCH /api/uploads/:id/report
 * Body: { weddingId }
 * Guest-accessible: increments report_count on an upload.
 */
router.patch('/:id/report', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { weddingId } = req.body as { weddingId?: string };

  if (!weddingId) {
    res.status(400).json({ error: 'Missing weddingId' });
    return;
  }

  try {
    const rows = await query<UploadRow>(
      `UPDATE uploads
       SET report_count = report_count + 1
       WHERE id = $1 AND wedding_id = $2
       RETURNING ${UPLOAD_COLS}`,
      [id, weddingId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[Uploads] PATCH report error:', err);
    res.status(500).json({ error: 'Failed to report upload' });
  }
});

/**
 * POST /api/update-upload
 * Body: { uploadId, weddingId, adminPassword, updates }
 * Admin: moderates upload (approve/hide/feature/etc).
 */
router.post('/update-upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { uploadId, weddingId, updates } = req.body as {
    uploadId?: string;
    weddingId: string;
    updates: Record<string, unknown>;
  };

  if (!uploadId) {
    res.status(400).json({ error: 'Missing uploadId' });
    return;
  }

  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'updates must be a plain object' });
    return;
  }

  try {
    const { clause, values } = buildSetClause(updates, SAFE_UPLOAD_COLUMNS, 3);

    if (!clause) {
      res.status(400).json({ error: 'No valid update fields provided' });
      return;
    }

    const rows = await query<UploadRow>(
      `UPDATE uploads SET ${clause}
       WHERE id = $1 AND wedding_id = $2
       RETURNING ${UPLOAD_COLS}`,
      [uploadId, weddingId, ...values]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Upload not found in this wedding' });
      return;
    }

    res.json({ success: true, upload: rows[0] });
  } catch (err) {
    console.error('[Uploads] update-upload error:', err);
    res.status(500).json({ error: 'Failed to update upload' });
  }
});

/**
 * POST /api/delete-file
 * Body: { uploadId, weddingId, adminPassword, filename? }
 * Admin: deletes file from Backblaze and removes DB row.
 */
router.post('/delete-file', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { uploadId, weddingId, filename } = req.body as {
    uploadId?: string;
    weddingId: string;
    filename?: string;
  };

  if (!uploadId) {
    res.status(400).json({ error: 'Missing uploadId' });
    return;
  }

  try {
    // Verify upload belongs to this wedding
    const uploadRows = await query<{ id: string; storage_path: string | null }>(
      'SELECT id, storage_path FROM uploads WHERE id = $1 AND wedding_id = $2',
      [uploadId, weddingId]
    );

    if (uploadRows.length === 0) {
      res.status(404).json({ error: 'Upload not found in this wedding' });
      return;
    }

    const storageKey = filename || uploadRows[0].storage_path;

    // Delete from Backblaze B2 if we have a key
    if (storageKey) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME || '',
          Key: storageKey,
        });
        await s3Client.send(command);
        console.log(`[Uploads] Deleted from B2: ${storageKey}`);
      } catch (s3Err) {
        // Log and continue — don't leave a DB orphan just because S3 failed
        console.error(`[Uploads] Failed to delete from B2 (${storageKey}):`, s3Err);
      }
    }

    // Delete DB row
    await query('DELETE FROM uploads WHERE id = $1', [uploadId]);

    res.json({ success: true });
  } catch (err) {
    console.error('[Uploads] delete-file error:', err);
    res.status(500).json({ error: 'Failed to delete upload' });
  }
});

/**
 * GET /api/admin/uploads?weddingId=&adminPassword=&limit=&offset=
 * Admin: returns ALL uploads including hidden.
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

  try {
    const { valid, weddingExists } = await verifyAdminPassword(weddingId, adminPassword);
    if (!weddingExists) { res.status(404).json({ error: 'Wedding not found' }); return; }
    if (!valid) { res.status(401).json({ error: 'Invalid admin password' }); return; }

    const { limit, offset } = parsePagination(req.query as Record<string, string>);

    const rows = await query<UploadRow>(
      `SELECT ${UPLOAD_COLS}
       FROM uploads
       WHERE wedding_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [weddingId, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    console.error('[Uploads] admin GET error:', err);
    res.status(500).json({ error: 'Failed to fetch admin uploads' });
  }
});

/**
 * GET /api/message-wall?weddingId=&type=message|guestbook
 * Returns messages and guestbook entries (public).
 */
router.get('/message-wall', async (req: Request, res: Response): Promise<void> => {
  const { weddingId, type } = req.query as { weddingId?: string; type?: string };

  if (!weddingId) {
    res.status(400).json({ error: 'Missing weddingId query parameter' });
    return;
  }

  const params: unknown[] = [weddingId];
  let typeFilter = `AND type IN ('message', 'guestbook')`;

  if (type === 'message' || type === 'guestbook') {
    typeFilter = `AND type = $2`;
    params.push(type);
  }

  try {
    const rows = await query<UploadRow>(
      `SELECT ${UPLOAD_COLS}
       FROM uploads
       WHERE wedding_id = $1
         AND is_hidden = FALSE
         AND is_approved = TRUE
         ${typeFilter}
       ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[Uploads] message-wall error:', err);
    res.status(500).json({ error: 'Failed to fetch message wall' });
  }
});

export default router;
