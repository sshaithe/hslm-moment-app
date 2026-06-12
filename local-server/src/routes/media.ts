import { Router, Request, Response } from 'express';
import { Readable } from 'stream';

const router = Router();

/**
 * GET /api/media?file=uploads/abc123.jpg
 *
 * Expose media securely by proxying it directly from Backblaze B2.
 * This bypasses ISP-level blocks on B2 domains (e.g. in Turkey) and solves all CORS issues.
 */
router.get('/', (req: Request, res: Response): void => {
  const file = req.query.file as string | undefined;

  if (!file) {
    res.status(400).json({ error: 'Missing file query parameter' });
    return;
  }

  const publicBase = (process.env.B2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  if (!publicBase) {
    res.status(503).json({
      error: 'Media redirect not configured. Set B2_PUBLIC_BASE_URL in backend .env.',
    });
    return;
  }

  // Build the direct CDN URL
  const decodedFile = decodeURIComponent(file);
  const cdnUrl = `${publicBase}/${decodedFile}`;

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.redirect(302, cdnUrl);
});

export default router;
