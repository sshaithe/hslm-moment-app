/**
 * VowVault Plan B — Direct CDN Media URL Helper
 *
 * PLAN B CHANGE: Media is served directly from Backblaze/CDN.
 * Photos and videos are NEVER proxied through the local PC.
 * This keeps your home internet bandwidth free for API/metadata only.
 *
 * - Local/blob/data URLs: returned as-is (used during upload flow)
 * - Remote URLs (Backblaze, CDN): returned as-is (direct CDN access)
 * - No /api/media proxy path is generated
 *
 * The /api/media endpoint on the local backend still exists as a 302
 * redirect fallback, but the frontend will not call it for normal media loads.
 */
export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Local/Blob/Data URLs pass through unchanged (used during upload / offline mode)
  if (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('/') ||
    url.startsWith('./')
  ) {
    return url;
  }

  // All remote URLs (Backblaze, CDN, etc.) are returned directly.
  // The browser loads media straight from Backblaze/CDN — zero bytes through your PC.
  return url;
}
