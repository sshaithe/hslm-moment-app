import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/media?file=uploads/abc123.jpg
 *
 * PLAN B: This endpoint is a REDIRECT ONLY.
 * It does NOT download or stream any media bytes through your PC.
 * It issues an HTTP 302 redirect to the direct Backblaze/CDN URL.
 *
 * In Plan B, the frontend uses direct CDN URLs for all media.
 * This endpoint exists only as a legacy fallback for any URL patterns
 * that still point to /api/media.
 *
 * Bandwidth impact on your PC: ZERO (redirect costs ~1 KB, not the file itself).
 */
router.get('/', (req: Request, res: Response): void => {
  const file = req.query.file as string | undefined;

  if (!file) {
    res.status(400).json({ error: 'Missing file query parameter' });
    return;
  }

  const publicBase = (process.env.B2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  if (!publicBase) {
    // B2_PUBLIC_BASE_URL not configured — return an error rather than proxying
    res.status(503).json({
      error: 'Media redirect not configured. Set B2_PUBLIC_BASE_URL in backend .env.',
    });
    return;
  }

  // Build the direct CDN URL
  const decodedFile = decodeURIComponent(file);
  const cdnUrl = `${publicBase}/${decodedFile}`;

  // Aggressive cache header — redirect is cacheable for 1 year
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.redirect(302, cdnUrl);
});

export default router;
