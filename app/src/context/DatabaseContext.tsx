import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiBase, isRemoteBackend } from '../lib/apiClient';
import type { Wedding, Guest, Upload, Reaction, Comment, GuestSession } from '../lib/types';
import * as localStore from '../lib/localStore';

interface DatabaseContextProps {
  isSupabase: boolean;          // kept for screen compatibility — same as isRemoteBackend
  loading: boolean;
  wedding: Wedding;
  uploads: Upload[];
  guests: Guest[];
  comments: Comment[];
  reactions: Reaction[];
  currentGuest: GuestSession | null;
  isAdmin: boolean;
  isBanned: boolean;

  // Actions
  saveWeddingSettings: (updates: Partial<Wedding>) => Promise<void>;
  registerGuest: (firstName: string, lastName: string, tableNumber?: string) => Promise<Guest>;
  createUpload: (upload: Omit<Upload, 'created_at'>, file?: File | null, onProgress?: (percent: number) => void) => Promise<Upload>;
  modifyUpload: (id: string, updates: Partial<Upload>) => Promise<Upload | null>;
  removeUpload: (id: string) => Promise<boolean>;
  toggleReaction: (uploadId: string, guestId: string, type: 'heart' | 'laugh' | 'wow') => Promise<void>;
  submitComment: (uploadId: string, guestId: string, guestName: string, text: string) => Promise<Comment>;
  loginAsAdmin: (password: string) => Promise<boolean>;
  logoutAsAdmin: () => void;
  logoutGuestSession: () => void;
  toggleGuestBan: (guestId: string, shouldBan: boolean) => Promise<boolean>;

  // Helpers
  getReactionCounts: (uploadId: string) => { heart: number; laugh: number; wow: number };
  hasReacted: (uploadId: string, guestId: string, type: 'heart' | 'laugh' | 'wow') => boolean;

  // Setters
  setWedding: React.Dispatch<React.SetStateAction<Wedding>>;
  setUploads: React.Dispatch<React.SetStateAction<Upload[]>>;
  setGuests: React.Dispatch<React.SetStateAction<Guest[]>>;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  setReactions: React.Dispatch<React.SetStateAction<Reaction[]>>;

  // Targeted local-first refreshes
  refreshWeddingSettings: () => Promise<void>;
  refreshUploads: () => Promise<void>;
  refreshGuests: () => Promise<void>;
  refreshReactions: () => Promise<void>;
  refreshCommentsAndReactions: (uploadIds: string[]) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextProps | undefined>(undefined);

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  try {
    const raw = localStorage.getItem('vv_guest_session');
    let sessionId = '';
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
    if (sessionId) {
      headers['X-Guest-Session'] = sessionId;
    }
  } catch (e) {
    // ignore
  }
  return headers;
}

// ─── Typed fetch helpers ──────────────────────────────────────────────────────
async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  } catch (e) {
    throw e;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  // isSupabase kept as alias so all screens work without changes
  const isSupabase = isRemoteBackend;

  const [loading, setLoading] = useState(isRemoteBackend);
  const [wedding, setWedding] = useState<Wedding>(localStore.getWedding());
  const [uploads, setUploads] = useState<Upload[]>(isRemoteBackend ? [] : localStore.getUploads());
  const [guests, setGuests] = useState<Guest[]>(isRemoteBackend ? [] : localStore.getGuests());
  const [comments, setComments] = useState<Comment[]>(isRemoteBackend ? [] : localStore.getComments());
  const [reactions, setReactions] = useState<Reaction[]>(isRemoteBackend ? [] : localStore.getReactions());
  const [currentGuest, setCurrentGuest] = useState<GuestSession | null>(localStore.getGuestSession());
  const [isAdmin, setIsAdmin] = useState<boolean>(localStore.isAdminAuthenticated());
  const [isBanned, setIsBanned] = useState<boolean>(false);

  const weddingIdRef = useRef<string>(localStore.getWedding()?.id || '');

  // ─── Track ban status ────────────────────────────────────────────────────
  useEffect(() => {
    if (currentGuest && guests.length > 0) {
      const match = guests.find((g) => g.id === currentGuest.guest_id);
      setIsBanned(match ? !!match.is_banned : false);
    } else {
      setIsBanned(false);
    }
  }, [currentGuest, guests]);

  // ─── Upload media to Backblaze (presigned URL flow) ───────────────────────
  // Media goes DIRECTLY from browser → Backblaze. Zero bytes through local PC.
  const uploadMedia = async (
    fileOrBase64: File | string,
    fileName: string,
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    let blob: Blob;
    let mimeType = 'image/jpeg';

    if (typeof fileOrBase64 !== 'string') {
      blob = fileOrBase64;
      mimeType = fileOrBase64.type;
    } else if (fileOrBase64.startsWith('data:')) {
      const arr = fileOrBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      blob = new Blob([u8arr], { type: mime });
      mimeType = mime;
    } else {
      const res = await fetch(fileOrBase64);
      if (!res.ok) throw new Error(`Failed to fetch media source: ${res.statusText}`);
      blob = await res.blob();
      mimeType = blob.type;
    }

    if (isRemoteBackend) {
      // 1. Get presigned URL from local backend
      const response = await fetch(`${apiBase}/api/get-upload-url`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          filename: fileName,
          contentType: mimeType,
          weddingId: wedding.id,
          fileSize: blob.size,
          guestId: currentGuest?.guest_id || 'anonymous',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to get upload URL');
      }

      const { uploadUrl } = await response.json();

      // 2. Upload DIRECTLY to Backblaze — never through local PC
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', mimeType);

        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload to Backblaze failed: ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload to Backblaze'));
        xhr.send(blob);
      });

      // 3. Return direct Backblaze/CDN public URL (no proxy)
      const publicUrlBase = (import.meta.env.VITE_S3_PUBLIC_URL || '').replace(/\/$/, '');
      return `${publicUrlBase}/${fileName}`;
    }

    // Local-only fallback (no backend configured)
    if (typeof fileOrBase64 !== 'string') {
      return URL.createObjectURL(fileOrBase64);
    }
    return fileOrBase64;
  };

  // ─── INITIAL DATA LOAD ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRemoteBackend) return;

    let mounted = true;

    const initialize = async () => {
      try {
        setLoading(true);

        // Resolve wedding slug from URL path or localStorage
        let resolvedSlug = '';
        const pathParts = window.location.pathname.split('/');
        const wIndex = pathParts.indexOf('wedding');
        if (wIndex !== -1 && pathParts[wIndex + 1]) {
          resolvedSlug = pathParts[wIndex + 1];
        } else {
          resolvedSlug = localStorage.getItem('vv_current_wedding_slug') || '';
        }

        let wData: Wedding | null = null;

        if (resolvedSlug) {
          wData = await apiGet<Wedding>(`/api/wedding?slug=${encodeURIComponent(resolvedSlug)}`);
        }

        if (!wData) {
          wData = await apiGet<Wedding>('/api/wedding?weddingId=wedding-demo-001');
        }

        if (!mounted) return;

        if (wData) {
          setWedding(wData);
          localStore.saveWedding(wData);
          localStorage.setItem('vv_current_wedding_slug', wData.slug);
          weddingIdRef.current = wData.id;
        } else {
          throw new Error('Failed to load wedding settings from local backend');
        }

        // Fetch uploads on initial load
        const uData = await apiGet<Upload[]>(`/api/uploads?weddingId=${wData.id}`);
        if (mounted && uData) setUploads(uData);

        // Fetch guests on initial load to populate active guests count
        const gData = await apiGet<Guest[]>(`/api/guests?weddingId=${wData.id}`);
        if (mounted && gData) setGuests(gData);

      } catch (err) {
        console.error('[DatabaseContext] Error loading initial data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();

    return () => { mounted = false; };
  }, []);

  // ─── REFRESH ACTIONS ──────────────────────────────────────────────────────

  const refreshWeddingSettings = async () => {
    if (!isRemoteBackend || !weddingIdRef.current) return;
    try {
      const data = await apiGet<Wedding>(`/api/wedding?weddingId=${weddingIdRef.current}`);
      if (data) {
        setWedding(data);
        localStore.saveWedding(data);
      }
    } catch (err) {
      console.error('[DatabaseContext] refreshWeddingSettings error:', err);
    }
  };

  const refreshUploads = async () => {
    if (!isRemoteBackend || !weddingIdRef.current) return;
    try {
      const data = await apiGet<Upload[]>(`/api/uploads?weddingId=${weddingIdRef.current}`);
      if (data) setUploads(data);
    } catch (err) {
      console.error('[DatabaseContext] refreshUploads error:', err);
    }
  };

  const refreshGuests = async () => {
    if (!isRemoteBackend || !weddingIdRef.current) return;
    try {
      const data = await apiGet<Guest[]>(`/api/guests?weddingId=${weddingIdRef.current}`);
      if (data) setGuests(data);
    } catch (err) {
      console.error('[DatabaseContext] refreshGuests error:', err);
    }
  };

  const refreshReactions = async () => {
    if (!isRemoteBackend || !weddingIdRef.current) return;
    try {
      // Get all upload IDs for this wedding
      const uploadIds = uploads.map((u) => u.id);
      if (uploadIds.length === 0) { setReactions([]); return; }

      const data = await apiGet<Reaction[]>(
        `/api/reactions?uploadIds=${uploadIds.join(',')}`
      );
      if (data) setReactions(data);
    } catch (err) {
      console.error('[DatabaseContext] refreshReactions error:', err);
    }
  };

  const refreshCommentsAndReactions = async (uploadIds: string[]) => {
    if (!isRemoteBackend || uploadIds.length === 0) return;
    try {
      const ids = uploadIds.join(',');
      const [cData, rData] = await Promise.all([
        apiGet<Comment[]>(`/api/comments?uploadIds=${ids}`),
        apiGet<Reaction[]>(`/api/reactions?uploadIds=${ids}`),
      ]);

      if (cData) {
        setComments((prev) => [
          ...prev.filter((c) => !uploadIds.includes(c.upload_id)),
          ...cData,
        ]);
      }
      if (rData) {
        setReactions((prev) => [
          ...prev.filter((r) => !uploadIds.includes(r.upload_id)),
          ...rData,
        ]);
      }
    } catch (err) {
      console.error('[DatabaseContext] refreshCommentsAndReactions error:', err);
    }
  };

  // ─── MUTATIONS ────────────────────────────────────────────────────────────

  const saveWeddingSettings = async (updates: Partial<Wedding>) => {
    const nextWedding = { ...wedding, ...updates };
    setWedding(nextWedding);
    localStore.saveWedding(nextWedding);

    if (isRemoteBackend) {
      let customUpdates = { ...updates };

      // Upload banner/photo fields if they are base64
      const fieldsToUpload = ['hero_photo', 'couple_photo', 'gallery_banner', 'upload_placeholder_image'] as const;
      for (const field of fieldsToUpload) {
        const value = updates[field];
        if (value && value.startsWith('data:')) {
          try {
            const fileName = `settings/${field}_${Date.now()}.jpg`;
            const publicUrl = await uploadMedia(value, fileName);
            customUpdates[field] = publicUrl;
          } catch (err) {
            console.error(`[DatabaseContext] Error uploading ${field}:`, err);
          }
        }
      }

      if (Object.keys(customUpdates).some((k) => customUpdates[k as keyof Wedding] !== updates[k as keyof Wedding])) {
        setWedding((prev) => ({ ...prev, ...customUpdates }));
      }

      const adminPassword = localStore.getAdminPassword() || '';
      await fetch(`${apiBase}/api/update-settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ weddingId: wedding.id, updates: customUpdates, adminPassword }),
      });
    }
  };

  const ensureGuestSynced = async (guestId: string) => {
    if (!isRemoteBackend) return;
    const guestExistsInState = guests.some((g) => g.id === guestId);
    if (!guestExistsInState) {
      const session = localStore.getGuestSession();
      if (session && session.guest_id === guestId) {
        try {
          const guestToSync: Guest = {
            id: session.guest_id,
            wedding_id: session.wedding_id,
            first_name: session.first_name,
            last_name: session.last_name,
            table_number: '',
            joined_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          };
          const data = await apiPost<Guest>('/api/guests', guestToSync);
          if (data) {
            setGuests((prev) => {
              if (prev.some((g) => g.id === data.id)) return prev;
              return [...prev, data];
            });
          }
        } catch (err) {
          console.error('[DatabaseContext] Error syncing guest:', err);
        }
      }
    }
  };

  const registerGuest = async (firstName: string, lastName: string, tableNumber?: string): Promise<Guest> => {
    const tempId = crypto.randomUUID();
    const guestData: Guest = {
      id: tempId,
      wedding_id: wedding.id,
      first_name: firstName,
      last_name: lastName,
      table_number: tableNumber || '',
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    const session: GuestSession = {
      guest_id: guestData.id,
      first_name: guestData.first_name,
      last_name: guestData.last_name,
      wedding_id: guestData.wedding_id,
    };
    localStore.setGuestSession(session);
    setCurrentGuest(session);

    if (isRemoteBackend) {
      try {
        const data = await apiPost<Guest>('/api/guests', guestData);
        if (!data) throw new Error('No data returned from guest registration');

        const dbSession: GuestSession = {
          guest_id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          wedding_id: data.wedding_id,
        };
        localStore.setGuestSession(dbSession);
        setCurrentGuest(dbSession);
        setGuests((prev) => [...prev, data]);
        return data;
      } catch (err) {
        console.error('[DatabaseContext] Error registering guest:', err);
        // Fallback to local state
        setGuests((prev) => [...prev, guestData]);
        return guestData;
      }
    } else {
      const added = localStore.addGuest(guestData);
      setGuests((prev) => [...prev, added]);
      return added;
    }
  };

  const createUpload = async (
    upload: Omit<Upload, 'created_at'>,
    file?: File | null,
    onProgress?: (percent: number) => void
  ): Promise<Upload> => {
    if (isRemoteBackend) {
      let public_url = upload.public_url || '';

      if (upload.guest_id) {
        await ensureGuestSynced(upload.guest_id);
      }

      // Upload media file (if local File or blob/base64) directly to Backblaze
      if (file) {
        try {
          const extension = upload.type === 'video' ? 'mp4' : 'jpg';
          const fileName = `uploads/${upload.id}.${extension}`;
          public_url = await uploadMedia(file, fileName, onProgress);
        } catch (err) {
          console.error('[DatabaseContext] Error uploading file to Backblaze:', err);
          throw err;
        }
      } else if (upload.local_url && (upload.local_url.startsWith('data:') || upload.local_url.startsWith('blob:'))) {
        try {
          const extension = upload.type === 'video' ? 'mp4' : 'jpg';
          const fileName = `uploads/${upload.id}.${extension}`;
          public_url = await uploadMedia(upload.local_url, fileName, onProgress);
        } catch (err) {
          console.error('[DatabaseContext] Error uploading file to Backblaze:', err);
          throw err;
        }
      }

      const newUpload: Upload = {
        ...upload,
        guest_id: upload.guest_id === 'anonymous' ? null : upload.guest_id,
        public_url,
        local_url: undefined, // do not persist blob URLs
        created_at: new Date().toISOString(),
      };

      // Optimistic update
      setUploads((prev) => [newUpload, ...prev]);

      try {
        const data = await apiPost<Upload>('/api/uploads/metadata', newUpload);
        if (!data) throw new Error('No data returned from upload metadata creation');
        return data;
      } catch (err) {
        console.error('[DatabaseContext] Error saving upload metadata:', err);
        throw err;
      }
    } else {
      const newUpload: Upload = { ...upload, created_at: new Date().toISOString() };
      const added = localStore.addUpload(newUpload);
      setUploads((prev) => [added, ...prev]);
      return added;
    }
  };

  const modifyUpload = async (id: string, updates: Partial<Upload>): Promise<Upload | null> => {
    // Optimistic update
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));

    if (isRemoteBackend) {
      const isAdminKeys =
        'is_approved' in updates ||
        'is_featured' in updates ||
        ('is_hidden' in updates && !('report_count' in updates));

      if (isAdminKeys) {
        const adminPassword = localStore.getAdminPassword() || '';
        try {
          const response = await fetch(`${apiBase}/api/update-upload`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ uploadId: id, weddingId: wedding.id, updates, adminPassword }),
          });
          if (!response.ok) {
            console.error('[DatabaseContext] Failed to update upload via admin API');
            return null;
          }
          const data = await response.json();
          return data.upload as Upload;
        } catch (err) {
          console.error('[DatabaseContext] modifyUpload admin error:', err);
          return null;
        }
      } else {
        // Guest report flow — increment report_count
        try {
          const response = await fetch(`${apiBase}/api/uploads/${id}/report`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ weddingId: wedding.id }),
          });
          if (!response.ok) return null;
          return response.json() as Promise<Upload>;
        } catch (err) {
          console.error('[DatabaseContext] modifyUpload report error:', err);
          return null;
        }
      }
    } else {
      return localStore.updateUpload(id, updates);
    }
  };

  const removeUpload = async (id: string): Promise<boolean> => {
    const upload = uploads.find((u) => u.id === id);
    setUploads((prev) => prev.filter((u) => u.id !== id));

    if (isRemoteBackend) {
      try {
        let filename: string | undefined;
        if (upload?.public_url) {
          try {
            const urlObj = new URL(upload.public_url);
            const pathName = decodeURIComponent(urlObj.pathname);
            filename = pathName.startsWith('/') ? pathName.substring(1) : pathName;
          } catch {
            filename = upload.storage_path || undefined;
          }
        }

        const adminPassword = localStore.getAdminPassword() || '';
        const response = await fetch(`${apiBase}/api/delete-file`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ filename, adminPassword, weddingId: wedding.id, uploadId: id }),
        });

        if (!response.ok) {
          console.error('[DatabaseContext] Failed to delete upload');
          return false;
        }
        return true;
      } catch (err) {
        console.error('[DatabaseContext] removeUpload error:', err);
        return false;
      }
    } else {
      return localStore.deleteUpload(id);
    }
  };

  const toggleReaction = async (
    uploadId: string,
    guestId: string,
    type: 'heart' | 'laugh' | 'wow'
  ): Promise<void> => {
    const reacted = hasReacted(uploadId, guestId, type);

    if (isRemoteBackend) {
      await ensureGuestSynced(guestId);

      if (reacted) {
        // Optimistic delete
        setReactions((prev) =>
          prev.filter((r) => !(r.upload_id === uploadId && r.guest_id === guestId && r.type === type))
        );
      } else {
        // Optimistic insert
        const newReaction: Reaction = {
          id: crypto.randomUUID(),
          upload_id: uploadId,
          guest_id: guestId,
          type,
          created_at: new Date().toISOString(),
        };
        setReactions((prev) => [...prev, newReaction]);
      }

      try {
        await apiPost('/api/reactions', {
          id: crypto.randomUUID(),
          upload_id: uploadId,
          guest_id: guestId,
          type,
        });
      } catch (err) {
        console.error('[DatabaseContext] toggleReaction error:', err);
        // Revert on error
        if (reacted) {
          const reverted: Reaction = { id: crypto.randomUUID(), upload_id: uploadId, guest_id: guestId, type, created_at: new Date().toISOString() };
          setReactions((prev) => [...prev, reverted]);
        } else {
          setReactions((prev) =>
            prev.filter((r) => !(r.upload_id === uploadId && r.guest_id === guestId && r.type === type))
          );
        }
      }
    } else {
      if (reacted) {
        localStore.removeReaction(uploadId, guestId, type);
        setReactions((prev) =>
          prev.filter((r) => !(r.upload_id === uploadId && r.guest_id === guestId && r.type === type))
        );
      } else {
        const newReaction: Reaction = {
          id: crypto.randomUUID(),
          upload_id: uploadId,
          guest_id: guestId,
          type,
          created_at: new Date().toISOString(),
        };
        localStore.addReaction(newReaction);
        setReactions((prev) => [...prev, newReaction]);
      }
    }
  };

  const submitComment = async (
    uploadId: string,
    guestId: string,
    guestName: string,
    text: string
  ): Promise<Comment> => {
    if (isRemoteBackend) {
      await ensureGuestSynced(guestId);
    }

    const newComment: Comment = {
      id: crypto.randomUUID(),
      upload_id: uploadId,
      guest_id: guestId,
      guest_name: guestName,
      text,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setComments((prev) => [...prev, newComment]);

    if (isRemoteBackend) {
      try {
        const data = await apiPost<Comment>('/api/comments', newComment);
        return data || newComment;
      } catch (err) {
        console.error('[DatabaseContext] submitComment error:', err);
        return newComment;
      }
    } else {
      return localStore.addComment(newComment);
    }
  };

  const loginAsAdmin = async (password: string): Promise<boolean> => {
    let success = false;

    if (isRemoteBackend) {
      try {
        const response = await fetch(`${apiBase}/api/admin/login`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ weddingId: wedding.id, adminPassword: password }),
        });
        success = response.ok;
      } catch (err) {
        console.error('[DatabaseContext] loginAsAdmin error:', err);
        success = false;
      }
    } else {
      success = password === wedding.admin_password_hash;
    }

    if (success) {
      localStore.setAdminAuthenticated(true);
      localStore.setAdminPassword(password);
      setIsAdmin(true);
    }
    return success;
  };

  const logoutAsAdmin = () => {
    localStore.setAdminAuthenticated(false);
    localStore.clearAdminPassword();
    setIsAdmin(false);
  };

  const logoutGuestSession = () => {
    localStore.clearGuestSession();
    setCurrentGuest(null);
  };

  const toggleGuestBan = async (guestId: string, shouldBan: boolean): Promise<boolean> => {
    // Optimistic update
    setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, is_banned: shouldBan } : g)));

    if (isRemoteBackend) {
      try {
        const adminPassword = localStore.getAdminPassword() || '';
        const response = await fetch(`${apiBase}/api/update-guest`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            guestId,
            weddingId: wedding.id,
            updates: { is_banned: shouldBan },
            adminPassword,
          }),
        });

        if (!response.ok) {
          // Revert
          setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, is_banned: !shouldBan } : g)));
          return false;
        }

        const data = await response.json();
        if (data.success && data.guest) {
          setGuests((prev) => prev.map((g) => (g.id === guestId ? (data.guest as Guest) : g)));
        }
        return true;
      } catch (err) {
        console.error('[DatabaseContext] toggleGuestBan error:', err);
        setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, is_banned: !shouldBan } : g)));
        return false;
      }
    } else {
      const updated = localStore.updateGuest(guestId, { is_banned: shouldBan });
      if (updated) {
        setGuests((prev) => prev.map((g) => (g.id === guestId ? updated : g)));
        return true;
      }
      return false;
    }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  const getReactionCounts = (uploadId: string) => {
    const filtered = reactions.filter((r) => r.upload_id === uploadId);
    return {
      heart: filtered.filter((r) => r.type === 'heart').length,
      laugh: filtered.filter((r) => r.type === 'laugh').length,
      wow: filtered.filter((r) => r.type === 'wow').length,
    };
  };

  const hasReacted = (uploadId: string, guestId: string, type: 'heart' | 'laugh' | 'wow') => {
    return reactions.some((r) => r.upload_id === uploadId && r.guest_id === guestId && r.type === type);
  };

  return (
    <DatabaseContext.Provider
      value={{
        isSupabase,
        loading,
        wedding,
        uploads,
        guests,
        comments,
        reactions,
        currentGuest,
        isAdmin,
        isBanned,
        saveWeddingSettings,
        registerGuest,
        createUpload,
        modifyUpload,
        removeUpload,
        toggleReaction,
        submitComment,
        loginAsAdmin,
        logoutAsAdmin,
        logoutGuestSession,
        toggleGuestBan,
        getReactionCounts,
        hasReacted,
        setWedding,
        setUploads,
        setGuests,
        setComments,
        setReactions,
        refreshWeddingSettings,
        refreshUploads,
        refreshGuests,
        refreshReactions,
        refreshCommentsAndReactions,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}
