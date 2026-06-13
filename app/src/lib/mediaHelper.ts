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

  // Rewrite blocked Backblaze URLs to use the CDN URL (solving Turkish ISP blocks and CORS issues)
  const cdnBase = import.meta.env.VITE_S3_PUBLIC_URL;
  if (cdnBase && url.includes('backblazeb2.com')) {
    // Extract everything after the file bucket portion
    // Example: https://f003.backblazeb2.com/file/hslm-wedding-gallery/uploads/abc.jpg
    // matches: /file/[bucket-name]/[rest-of-url]
    const match = url.match(/\/file\/[^/]+\/(.+)$/);
    if (match && match[1]) {
      const cleanCdnBase = cdnBase.replace(/\/$/, '');
      return `${cleanCdnBase}/${match[1]}`;
    }
  }

  // All remote URLs are returned directly.
  return url;
}
