import { Router, Request, Response } from 'express';
import { Readable } from 'stream';

const router = Router();

/**
 * GET /api/media?file=uploads/abc123.jpg
 *
 * Expose media securely by proxying it directly from Backblaze B2.
 * This bypasses ISP-level blocks on B2 domains (e.g. in Turkey) and solves all CORS issues.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
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

  // Build the direct B2 URL
  const decodedFile = decodeURIComponent(file);
  const cdnUrl = `${publicBase}/${decodedFile}`;

  try {
    // Fetch directly from B2 from the local PC
    const response = await fetch(cdnUrl);

    if (!response.ok) {
      console.warn(`[Media Proxy] Fetch failed for ${cdnUrl} with status ${response.status}. Falling back to 302 redirect.`);
      res.redirect(302, cdnUrl);
      return;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Copy Content-Type and Content-Length if available
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (response.body) {
      Readable.fromWeb(response.body as any).pipe(res);
    } else {
      console.warn(`[Media Proxy] Empty response body for ${cdnUrl}. Falling back to 302 redirect.`);
      res.redirect(302, cdnUrl);
    }
  } catch (err: any) {
    console.error(`[Media Proxy] Error proxying ${cdnUrl}:`, err.message);
    // Fall back to 302 redirect
    res.redirect(302, cdnUrl);
  }
});

export default router;
