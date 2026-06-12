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
  return url;
}
