import { apiBase } from './apiClient';

/**
 * VowVault Plan B — Direct CDN Media URL Helper
 *
 * PLAN B CHANGE: Media is served directly from Backblaze/CDN.
 * However, because Backblaze domains (like f003.backblazeb2.com) are often blocked
 * on mobile networks in Turkey, we proxy B2 URLs through our local backend API.
 * This guarantees the images load everywhere and fixes CORS errors.
 *
 * - Local/blob/data URLs: returned as-is (used during upload flow)
 * - Remote B2 URLs: proxied via /api/media
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

  // If the URL is from Backblaze B2, route it through the API proxy
  if (url.includes('backblazeb2.com')) {
    const fileIndex = url.indexOf('/file/');
    if (fileIndex !== -1) {
      // Extract the bucket name and file path
      const bucketAndPath = url.substring(fileIndex + 6); // e.g. "hslm-wedding-gallery/uploads/..."
      const slashIndex = bucketAndPath.indexOf('/');
      if (slashIndex !== -1) {
        const filePath = bucketAndPath.substring(slashIndex + 1); // e.g. "uploads/..."
        return `${apiBase}/api/media?file=${encodeURIComponent(filePath)}`;
      }
    }
  }

  // All other remote URLs are returned directly.
  return url;
}
