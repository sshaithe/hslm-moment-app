import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query } from '../db';

const router = Router();

// ─── S3 client for Backblaze B2 ──────────────────────────────────────────────
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || '',
    secretAccessKey: process.env.B2_APPLICATION_KEY || '',
  },
  // Disable automatic CRC32 checksum — Backblaze B2 CORS does not allow these headers
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_PHOTO_SIZE = 20 * 1024 * 1024;   // 20 MB
const MAX_VIDEO_SIZE = 150 * 1024 * 1024;  // 150 MB
const MAX_VIDEOS_PER_GUEST = 10;
const MAX_PHOTOS_PER_GUEST = 50;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// ─── Rows returned from DB ────────────────────────────────────────────────────
interface WeddingRow {
  uploads_paused: boolean;
  require_guest_name: boolean;
  max_photos_per_guest?: number;
  max_videos_per_guest?: number;
}
interface GuestRow { is_banned: boolean; }
interface CountRow { count: string; }

/**
 * POST /api/get-upload-url
 *
 * Generates a presigned PUT URL for direct browser → Backblaze B2 uploads.
 * Media NEVER passes through this server.
 *
 * Body: { filename, contentType, weddingId, fileSize, guestId? }
 * Returns: { uploadUrl }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { filename, contentType, weddingId, fileSize, guestId } = req.body as {
    filename?: string;
    contentType?: string;
    weddingId?: string;
    fileSize?: number;
    guestId?: string;
  };

  // ─── Basic field validation ────────────────────────────────────────────────
  if (!filename || !contentType || !weddingId) {
    res.status(400).json({ error: 'Missing required parameters: filename, contentType, weddingId' });
    return;
  }

  if (fileSize === undefined || typeof fileSize !== 'number') {
    res.status(400).json({ error: 'Missing or invalid parameter: fileSize (must be a number)' });
    return;
  }

  // ─── MIME type validation ─────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(contentType)) {
    res.status(400).json({ error: `Unsupported content type: ${contentType}` });
    return;
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);
  const isPhoto = ALLOWED_IMAGE_TYPES.includes(contentType);

  // ─── File size validation (per type) ─────────────────────────────────────
  if (isPhoto && fileSize > MAX_PHOTO_SIZE) {
    res.status(400).json({ error: `Photo size exceeds the 20 MB limit.` });
    return;
  }
  if (isVideo && fileSize > MAX_VIDEO_SIZE) {
    res.status(400).json({ error: `Video size exceeds the 150 MB limit.` });
    return;
  }

  try {
    // ─── Verify wedding exists and uploads are not paused ──────────────────
    const weddingRows = await query<WeddingRow>(
      'SELECT uploads_paused, require_guest_name, max_photos_per_guest, max_videos_per_guest FROM weddings WHERE id = $1',
      [weddingId]
    );

    if (weddingRows.length === 0) {
      res.status(404).json({ error: 'Wedding not found' });
      return;
    }

    const wedding = weddingRows[0];

    if (wedding.uploads_paused) {
      res.status(403).json({ error: 'Uploads are paused by the admin.' });
      return;
    }

    // ─── Reject anonymous upload if guest name is required ────────────────
    if (wedding.require_guest_name && (!guestId || guestId === 'anonymous')) {
      res.status(403).json({ error: 'Guest registration is required before uploading.' });
      return;
    }

    // ─── Guest-specific validations ───────────────────────────────────────
    if (guestId && guestId !== 'anonymous') {
      // Check guest is not banned
      const guestRows = await query<GuestRow>(
        'SELECT is_banned FROM guests WHERE id = $1 AND wedding_id = $2',
        [guestId, weddingId]
      );

      if (guestRows.length > 0 && guestRows[0].is_banned) {
        res.status(403).json({ error: 'Your account has been banned by the admin.' });
        return;
      }

      // Check per-guest upload limits
      if (isVideo) {
        const countRows = await query<CountRow>(
          "SELECT COUNT(*) as count FROM uploads WHERE guest_id = $1 AND type = 'video'",
          [guestId]
        );
        const count = parseInt(countRows[0]?.count || '0', 10);
        const maxVideos = wedding.max_videos_per_guest ?? MAX_VIDEOS_PER_GUEST;
        if (count >= maxVideos) {
          res.status(400).json({ error: `You have reached the video upload limit of ${maxVideos} videos.` });
          return;
        }
      } else if (isPhoto) {
        const countRows = await query<CountRow>(
          "SELECT COUNT(*) as count FROM uploads WHERE guest_id = $1 AND type = 'photo'",
          [guestId]
        );
        const count = parseInt(countRows[0]?.count || '0', 10);
        const maxPhotos = wedding.max_photos_per_guest ?? MAX_PHOTOS_PER_GUEST;
        if (count >= maxPhotos) {
          res.status(400).json({ error: `You have reached the photo upload limit of ${maxPhotos} photos.` });
          return;
        }
      }
    }

    // ─── Generate presigned URL ────────────────────────────────────────────
    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME || '',
      Key: filename,
      ContentType: contentType,
    });

    // 15 minutes — generous for large video uploads
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900,
      unhoistableHeaders: new Set(['x-amz-checksum-crc32', 'x-amz-sdk-checksum-algorithm']),
    });

    res.status(200).json({ uploadUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Backblaze] Error generating presigned URL:', err);
    res.status(500).json({ error: message });
  }
});

export default router;
