import { Router, Request, Response } from 'express';
import { query } from '../db';
import { verifyAdminPassword } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * POST /api/admin/login
 * Body: { weddingId, adminPassword }
 * Returns { success: true } on valid admin password.
 * Supports both plain-text and bcrypt passwords.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { weddingId, adminPassword } = req.body as {
    weddingId?: string;
    adminPassword?: string;
  };

  if (!weddingId || !adminPassword) {
    res.status(400).json({ error: 'Missing weddingId or adminPassword' });
    return;
  }

  try {
    const { valid, weddingExists } = await verifyAdminPassword(weddingId, adminPassword);

    if (!weddingExists) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Invalid admin password' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/dashboard?weddingId=&adminPassword=
 * Returns dashboard stats for the admin panel.
 */
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
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

    const [uploadsStats, guestsStats] = await Promise.all([
      query<{ total: string; pending: string; hidden: string; featured: string }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE NOT is_approved AND NOT is_hidden) as pending,
           COUNT(*) FILTER (WHERE is_hidden) as hidden,
           COUNT(*) FILTER (WHERE is_featured) as featured
         FROM uploads WHERE wedding_id = $1`,
        [weddingId]
      ),
      query<{ total: string; banned: string }>(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_banned) as banned
         FROM guests WHERE wedding_id = $1`,
        [weddingId]
      ),
    ]);

    res.json({
      uploads: uploadsStats[0] || { total: 0, pending: 0, hidden: 0, featured: 0 },
      guests: guestsStats[0] || { total: 0, banned: 0 },
    });
  } catch (err) {
    console.error('[Admin] Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * POST /api/admin/upgrade-password  (Optional Phase 2)
 * Body: { weddingId, adminPassword }
 * Converts a plain-text admin password to a bcrypt hash.
 * Safe to call multiple times — skips if already hashed.
 */
router.post('/upgrade-password', async (req: Request, res: Response): Promise<void> => {
  const { weddingId, adminPassword } = req.body as {
    weddingId?: string;
    adminPassword?: string;
  };

  if (!weddingId || !adminPassword) {
    res.status(400).json({ error: 'Missing weddingId or adminPassword' });
    return;
  }

  try {
    const rows = await query<{ admin_password_hash: string }>(
      'SELECT admin_password_hash FROM weddings WHERE id = $1',
      [weddingId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const stored = rows[0].admin_password_hash;

    // Already bcrypt — nothing to do
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
      res.json({ success: true, message: 'Password is already hashed with bcrypt.' });
      return;
    }

    // Verify plain-text password before hashing
    if (adminPassword !== stored) {
      res.status(401).json({ error: 'Provided password does not match stored password' });
      return;
    }

    // Hash and store
    const hashed = await bcrypt.hash(adminPassword, 12);
    await query('UPDATE weddings SET admin_password_hash = $1 WHERE id = $2', [hashed, weddingId]);

    res.json({ success: true, message: 'Password upgraded to bcrypt hash successfully.' });
  } catch (err) {
    console.error('[Admin] Upgrade password error:', err);
    res.status(500).json({ error: 'Failed to upgrade password' });
  }
});

export default router;
