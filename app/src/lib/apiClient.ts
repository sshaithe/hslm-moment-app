/**
 * VowVault Plan B — API Client
 *
 * Replaces supabaseClient.ts in the local-server-plan-b branch.
 * Points all data requests to the local Node.js/Express backend.
 *
 * Set VITE_API_BASE_URL in your frontend .env to:
 *   - http://localhost:4000         (local development)
 *   - https://api.yourtunnel.com   (Cloudflare Tunnel — only when you approve)
 */

// Base URL for the local backend API.
// Falls back to localhost:4000 if not set (convenient for local dev).
export const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

// True when the backend API URL is configured.
// Used throughout DatabaseContext to decide whether to use REST API or local-only mode.
export const isRemoteBackend = !!import.meta.env.VITE_API_BASE_URL;

// Ensure vv_device_session exists on first page load (before any request is sent)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem('vv_guest_session');
    let hasGuest = false;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.guest_id) {
        hasGuest = true;
      }
    }
    if (!hasGuest) {
      let devSession = localStorage.getItem('vv_device_session');
      if (!devSession) {
        devSession = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('vv_device_session', devSession);
      }
    }
  } catch (e) {
    console.error('[SessionInit] Error ensuring vv_device_session:', e);
  }
}

// ─── Typed fetch wrapper ──────────────────────────────────────────────────────
// Centralised error handling: throws an Error with the server error message.
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${apiBase}${path}`;

  // Dynamically extract guest_id or generate/retrieve device session token for rate limiting (Wi-Fi NAT bypass)
  let sessionId = '';
  try {
    const raw = localStorage.getItem('vv_guest_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.guest_id) {
        sessionId = parsed.guest_id;
      }
    }

    if (!sessionId) {
      let devSession = localStorage.getItem('vv_device_session');
      if (!devSession) {
        devSession = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('vv_device_session', devSession);
      }
      sessionId = devSession;
    }
  } catch {
    // ignore parsing/access errors
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (sessionId) {
    headers['X-Guest-Session'] = sessionId;
  }

  const res = await fetch(url, {
    headers: headers as HeadersInit,
    ...options,
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse failures
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
