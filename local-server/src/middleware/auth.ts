import { Request, Response, NextFunction } from 'express';
import { query } from '../db';
import bcrypt from 'bcryptjs';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WeddingRow {
  admin_password_hash: string;
}

// ─── Verify admin password ────────────────────────────────────────────────────
// Supports two modes:
//   1. Plain-text comparison (current production behavior — preserved for compatibility)
//   2. bcrypt comparison (if the stored hash starts with '$2b$' — optional Phase 2 upgrade)
//
// Security note: Plain-text password storage is a known risk. See final report.
// To upgrade: use POST /api/admin/upgrade-password to hash existing passwords.
export async function verifyAdminPassword(
  weddingId: string,
  submittedPassword: string
): Promise<{ valid: boolean; weddingExists: boolean }> {
  if (!weddingId || !submittedPassword) {
    return { valid: false, weddingExists: false };
  }

  const rows = await query<WeddingRow>(
    'SELECT admin_password_hash FROM weddings WHERE id = $1',
    [weddingId]
  );

  if (rows.length === 0) {
    return { valid: false, weddingExists: false };
  }

  const stored = rows[0].admin_password_hash;

  // bcrypt hash detection (Phase 2 upgrade path)
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    const valid = await bcrypt.compare(submittedPassword, stored);
    return { valid, weddingExists: true };
  }

  // Plain-text comparison (current behavior — Phase 1)
  return { valid: submittedPassword === stored, weddingExists: true };
}

// ─── Express middleware: require admin password in request body ───────────────
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { adminPassword, weddingId } = req.body as {
    adminPassword?: string;
    weddingId?: string;
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
      res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
      return;
    }

    next();
  } catch (err) {
    console.error('[Auth] Error verifying admin password:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

// ─── Express middleware: require admin password in query params (for GET requests) ──
export async function requireAdminQuery(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { adminPassword, weddingId } = req.query as {
    adminPassword?: string;
    weddingId?: string;
  };

  if (!weddingId || !adminPassword) {
    res.status(400).json({ error: 'Missing weddingId or adminPassword query parameters' });
    return;
  }

  try {
    const { valid, weddingExists } = await verifyAdminPassword(weddingId, adminPassword);

    if (!weddingExists) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
      return;
    }

    next();
  } catch (err) {
    console.error('[Auth] Error verifying admin password:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
