/**
 * Utility to proxy Backblaze B2 URLs through the same-origin serverless endpoint.
 * This resolves iCloud Private Relay blocks and DNS/ISP restrictions on iOS/tablets.
 */
export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Local/Blob/Data URLs do not need to be proxied
  if (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('/') ||
    url.startsWith('./')
  ) {
    return url;
  }

  // Attempt proxying via VITE_S3_PUBLIC_URL prefix matching first
  const publicUrlBase = import.meta.env.VITE_S3_PUBLIC_URL || '';
  if (publicUrlBase) {
    const base = publicUrlBase.endsWith('/') ? publicUrlBase : publicUrlBase + '/';
    if (url.startsWith(base)) {
      const fileKey = url.substring(base.length);
      return `/api/media?file=${encodeURIComponent(fileKey)}`;
    }
  }

  // Fallback pattern matching for any other S3/B2 configurations
  if (url.includes('backblazeb2.com') || url.includes('/file/')) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');

      const uploadsIndex = parts.indexOf('uploads');
      const settingsIndex = parts.indexOf('settings');
      const targetIndex = uploadsIndex !== -1 ? uploadsIndex : settingsIndex;

      if (targetIndex !== -1) {
        const fileKey = parts.slice(targetIndex).join('/');
        return `/api/media?file=${encodeURIComponent(fileKey)}`;
      }
    } catch (e) {
      console.error('Failed to parse media URL for proxying:', url, e);
    }
  }

  return url;
}
