import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { Wedding, Guest, Upload, Reaction, Comment, GuestSession } from '../lib/types';
import * as localStore from '../lib/localStore';

interface DatabaseContextProps {
  isSupabase: boolean;
  loading: boolean;
  wedding: Wedding;
  uploads: Upload[];
  guests: Guest[];
  comments: Comment[];
  reactions: Reaction[];
  currentGuest: GuestSession | null;
  isAdmin: boolean;
  
  // Actions
  saveWeddingSettings: (updates: Partial<Wedding>) => Promise<void>;
  registerGuest: (firstName: string, lastName: string, tableNumber?: string) => Promise<Guest>;
  createUpload: (upload: Omit<Upload, 'created_at'>, onProgress?: (percent: number) => void) => Promise<Upload>;
  modifyUpload: (id: string, updates: Partial<Upload>) => Promise<Upload | null>;
  removeUpload: (id: string) => Promise<boolean>;
  toggleReaction: (uploadId: string, guestId: string, type: 'heart' | 'laugh' | 'wow') => Promise<void>;
  submitComment: (uploadId: string, guestId: string, guestName: string, text: string) => Promise<Comment>;
  loginAsAdmin: (password: string) => Promise<boolean>;
  logoutAsAdmin: () => void;
  logoutGuestSession: () => void;

  // Helpers
  getReactionCounts: (uploadId: string) => { heart: number; laugh: number; wow: number };
  hasReacted: (uploadId: string, guestId: string, type: 'heart' | 'laugh' | 'wow') => boolean;
}

const DatabaseContext = createContext<DatabaseContextProps | undefined>(undefined);

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [wedding, setWedding] = useState<Wedding>(localStore.getWedding());
  const [uploads, setUploads] = useState<Upload[]>(localStore.getUploads());
  const [guests, setGuests] = useState<Guest[]>(localStore.getGuests());
  const [comments, setComments] = useState<Comment[]>(localStore.getComments());
  const [reactions, setReactions] = useState<Reaction[]>(localStore.getReactions());
  const [currentGuest, setCurrentGuest] = useState<GuestSession | null>(localStore.getGuestSession());
  const [isAdmin, setIsAdmin] = useState<boolean>(localStore.isAdminAuthenticated());

  const isSupabase = isSupabaseConfigured;

  // ─── UTILITY: Upload base64 or file to Cloudflare R2 ───
  const uploadMedia = async (
    fileOrBase64: string,
    fileName: string,
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    let blob: Blob;
    let mimeType = 'image/jpeg';

    if (fileOrBase64.startsWith('data:')) {
      const arr = fileOrBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
      mimeType = mime;
    } else {
      // Fallback or treat as fetchable URL (blob url)
      const res = await fetch(fileOrBase64);
      blob = await res.blob();
      mimeType = blob.type;
    }

    if (isSupabase) {
      // 1. Get S3 presigned upload URL from our Vercel API endpoint
      const response = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: fileName,
          contentType: mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get presigned URL: ${response.statusText}`);
      }

      const { uploadUrl } = await response.json();

      // 2. Upload file directly to Cloudflare R2 using the presigned URL with progress updates
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', mimeType);

        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Failed to upload to S3 Storage: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during upload to S3 Storage'));
        };

        xhr.send(blob);
      });

      // 3. Return the public URL of the uploaded file on S3 Storage
      const publicUrlBase = import.meta.env.VITE_S3_PUBLIC_URL || '';
      return `${publicUrlBase.replace(/\/$/, '')}/${fileName}`;
    }

    // Fallback for local-first testing: return the local blob/base64 URL itself
    return fileOrBase64;
  };

  // ─── INITIAL LOAD (SUPABASE ONLY) ───
  useEffect(() => {
    if (!isSupabase) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load settings
        const { data: wData } = await supabase!
          .from('weddings')
          .select('*')
          .eq('id', 'wedding-demo-001')
          .single();
        if (wData) setWedding(wData);

        // Load uploads
        const { data: uData } = await supabase!
          .from('uploads')
          .select('*')
          .order('created_at', { ascending: false });
        if (uData) setUploads(uData);

        // Load guests
        const { data: gData } = await supabase!.from('guests').select('*');
        if (gData) setGuests(gData);

        // Load comments
        const { data: cData } = await supabase!.from('comments').select('*');
        if (cData) setComments(cData);

        // Load reactions
        const { data: rData } = await supabase!.from('reactions').select('*');
        if (rData) setReactions(rData);
      } catch (err) {
        console.error('Error loading Supabase data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // ─── REAL-TIME SUBSCRIPTION (SUPABASE ONLY) ───
    const channel = supabase!
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weddings' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setWedding(payload.new as Wedding);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUploads((prev) => {
            if (prev.some((u) => u.id === payload.new.id)) return prev;
            return [payload.new as Upload, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setUploads((prev) => prev.map((u) => (u.id === payload.new.id ? (payload.new as Upload) : u)));
        } else if (payload.eventType === 'DELETE') {
          setUploads((prev) => prev.filter((u) => u.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setGuests((prev) => {
            if (prev.some((g) => g.id === payload.new.id)) return prev;
            return [...prev, payload.new as Guest];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setComments((prev) => {
            if (prev.some((c) => c.id === payload.new.id)) return prev;
            return [...prev, payload.new as Comment];
          });
        } else if (payload.eventType === 'DELETE') {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReactions((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev;
            return [...prev, payload.new as Reaction];
          });
        } else if (payload.eventType === 'DELETE') {
          setReactions((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [isSupabase]);

  // ─── MUTATIONS & ACTIONS ───

  const saveWeddingSettings = async (updates: Partial<Wedding>) => {
    const nextWedding = { ...wedding, ...updates };
    setWedding(nextWedding);
    localStore.saveWedding(nextWedding);

    if (isSupabase) {
      // Handle banner/portrait file uploads if they are custom base64
      let customUpdates = { ...updates };
      const fieldsToUpload = ['hero_photo', 'couple_photo', 'gallery_banner'] as const;
      
      for (const field of fieldsToUpload) {
        const value = updates[field];
        if (value && value.startsWith('data:')) {
          try {
            const fileName = `settings/${field}_${Date.now()}.jpg`;
            const publicUrl = await uploadMedia(value, fileName);
            customUpdates[field] = publicUrl;
          } catch (err) {
            console.error(`Error uploading ${field} to Supabase:`, err);
          }
        }
      }

      // Update state again if we uploaded files
      if (Object.keys(customUpdates).some((k) => customUpdates[k as keyof Wedding] !== updates[k as keyof Wedding])) {
        setWedding((prev) => ({ ...prev, ...customUpdates }));
      }

      await supabase!
        .from('weddings')
        .update(customUpdates)
        .eq('id', wedding.id);
    }
  };

  const ensureGuestSynced = async (guestId: string) => {
    if (!isSupabase) return;
    const guestExistsInState = guests.some((g) => g.id === guestId);
    if (!guestExistsInState) {
      // Guest not in Supabase — insert them now
      const session = localStore.getGuestSession();
      if (session && session.guest_id === guestId) {
        const guestToSync: Guest = {
          id: session.guest_id,
          wedding_id: session.wedding_id,
          first_name: session.first_name,
          last_name: session.last_name,
          table_number: '',
          joined_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };
        const { data: guestData, error: guestError } = await supabase!
          .from('guests')
          .upsert([guestToSync], { onConflict: 'id' })
          .select()
          .single();
        if (!guestError && guestData) {
          setGuests((prev) => {
            if (prev.some((g) => g.id === guestData.id)) return prev;
            return [...prev, guestData as Guest];
          });
        } else if (guestError) {
          console.error('Error syncing guest to Supabase:', guestError);
        }
      }
    }
  };

  const registerGuest = async (firstName: string, lastName: string, tableNumber?: string) => {
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

    // Store session locally
    const session: GuestSession = {
      guest_id: guestData.id,
      first_name: guestData.first_name,
      last_name: guestData.last_name,
      wedding_id: guestData.wedding_id,
    };
    localStore.setGuestSession(session);
    setCurrentGuest(session);

    if (isSupabase) {
      const { data, error } = await supabase!
        .from('guests')
        .insert([guestData])
        .select()
        .single();

      if (error) {
        console.error('Error inserting guest in Supabase:', error);
        // Fallback to local state if offline/error
        setGuests((prev) => [...prev, guestData]);
        return guestData;
      }
      
      // Update session with DB generated UUID
      const dbGuest = data as Guest;
      const dbSession: GuestSession = {
        guest_id: dbGuest.id,
        first_name: dbGuest.first_name,
        last_name: dbGuest.last_name,
        wedding_id: dbGuest.wedding_id,
      };
      localStore.setGuestSession(dbSession);
      setCurrentGuest(dbSession);

      setGuests((prev) => [...prev, dbGuest]);
      return dbGuest;
    } else {
      const added = localStore.addGuest(guestData);
      setGuests((prev) => [...prev, added]);
      return added;
    }
  };

  const createUpload = async (upload: Omit<Upload, 'created_at'>, onProgress?: (percent: number) => void) => {
    if (isSupabase) {
      let public_url = upload.public_url || '';
      
      if (upload.guest_id) {
        await ensureGuestSynced(upload.guest_id);
      }

      // If local_url contains media file, upload to storage
      if (upload.local_url && (upload.local_url.startsWith('data:') || upload.local_url.startsWith('blob:'))) {
        try {
          const extension = upload.type === 'video' ? 'mp4' : 'jpg';
          const fileName = `uploads/${upload.id}.${extension}`;
          public_url = await uploadMedia(upload.local_url, fileName, onProgress);
        } catch (err) {
          console.error('Error uploading upload file to Supabase storage:', err);
        }
      }

      const newUpload: Upload = {
        ...upload,
        public_url,
        local_url: undefined, // remove blobs before inserting
        created_at: new Date().toISOString(),
      };

      // Optimistic state update
      setUploads((prev) => [newUpload, ...prev]);

      const { data, error } = await supabase!
        .from('uploads')
        .insert([newUpload])
        .select()
        .single();

      if (error) {
        console.error('Error creating upload in Supabase:', error);
        return newUpload;
      }
      return data as Upload;
    } else {
      const newUpload: Upload = {
        ...upload,
        created_at: new Date().toISOString(),
      };
      const added = localStore.addUpload(newUpload);
      setUploads((prev) => [added, ...prev]);
      return added;
    }
  };

  const modifyUpload = async (id: string, updates: Partial<Upload>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));

    if (isSupabase) {
      const { data, error } = await supabase!
        .from('uploads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating upload in Supabase:', error);
        return null;
      }
      return data as Upload;
    } else {
      const updated = localStore.updateUpload(id, updates);
      return updated;
    }
  };

  const removeUpload = async (id: string) => {
    const upload = uploads.find((u) => u.id === id);
    setUploads((prev) => prev.filter((u) => u.id !== id));

    if (isSupabase) {
      if (upload && upload.public_url && (upload.type === 'photo' || upload.type === 'video')) {
        try {
          const urlObj = new URL(upload.public_url);
          const pathName = decodeURIComponent(urlObj.pathname);
          const filename = pathName.startsWith('/') ? pathName.substring(1) : pathName;
          
          await fetch('/api/delete-file', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename }),
          });
        } catch (err) {
          console.error('Failed to delete media file from storage:', err);
        }
      }

      const { error } = await supabase!.from('uploads').delete().eq('id', id);
      if (error) {
        console.error('Error deleting upload in Supabase:', error);
        return false;
      }
      return true;
    } else {
      return localStore.deleteUpload(id);
    }
  };

  const toggleReaction = async (uploadId: string, guestId: string, type: 'heart' | 'laugh' | 'wow') => {
    const reacted = hasReacted(uploadId, guestId, type);

    if (isSupabase) {
      await ensureGuestSynced(guestId);
      if (reacted) {
        // Optimistic delete
        setReactions((prev) =>
          prev.filter((r) => !(r.upload_id === uploadId && r.guest_id === guestId && r.type === type))
        );

        await supabase!
          .from('reactions')
          .delete()
          .match({ upload_id: uploadId, guest_id: guestId, type });
      } else {
        const newReaction: Reaction = {
          id: crypto.randomUUID(),
          upload_id: uploadId,
          guest_id: guestId,
          type,
          created_at: new Date().toISOString(),
        };

        // Optimistic insert
        setReactions((prev) => [...prev, newReaction]);

        await supabase!.from('reactions').insert([newReaction]);
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

  const submitComment = async (uploadId: string, guestId: string, guestName: string, text: string) => {
    if (isSupabase) {
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

    // Optimistic state update
    setComments((prev) => [...prev, newComment]);

    if (isSupabase) {
      const { data, error } = await supabase!
        .from('comments')
        .insert([newComment])
        .select()
        .single();

      if (error) {
        console.error('Error inserting comment in Supabase:', error);
        return newComment;
      }
      return data as Comment;
    } else {
      const added = localStore.addComment(newComment);
      return added;
    }
  };

  const loginAsAdmin = async (password: string) => {
    // For prototype/simplicity, we compare password directly or check hash
    // If Supabase is active, we can check password_hash in weddings setting
    let success = false;
    if (isSupabase) {
      const { data } = await supabase!
        .from('weddings')
        .select('admin_password_hash')
        .eq('id', wedding.id)
        .single();
      
      const savedHash = data?.admin_password_hash || '';
      // Simple direct compare for prototype (or bcrypt if hash is active)
      success = password === savedHash;
    } else {
      success = password === wedding.admin_password_hash;
    }

    if (success) {
      localStore.setAdminAuthenticated(true);
      setIsAdmin(true);
    }
    return success;
  };

  const logoutAsAdmin = () => {
    localStore.setAdminAuthenticated(false);
    setIsAdmin(false);
  };

  const logoutGuestSession = () => {
    localStore.clearGuestSession();
    setCurrentGuest(null);
  };

  // ─── HELPERS ───

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
        getReactionCounts,
        hasReacted,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}
