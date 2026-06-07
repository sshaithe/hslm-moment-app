import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Fallback to load env variables from .env.local in development if they are not loaded by the host
if (!process.env.VITE_SUPABASE_URL) {
  try {
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const envConfig = fs.readFileSync(envLocalPath, 'utf8');
      envConfig.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.error('Failed to load .env.local fallback:', e);
  }
}

// Initialize Supabase client with Service Role Key to bypass RLS securely
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  // CORS configuration to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight options request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uploadId, weddingId, updates, adminPassword } = req.body;

    if (!uploadId || !weddingId || !updates || !adminPassword) {
      return res.status(400).json({ error: 'Missing required parameters (uploadId, weddingId, updates, adminPassword)' });
    }

    // ─── AUTHENTICATION CHECK ───
    const { data: wedding, error: dbError } = await supabase
      .from('weddings')
      .select('admin_password_hash')
      .eq('id', weddingId)
      .single();

    if (dbError || !wedding) {
      console.error('Database error fetching wedding admin password:', dbError);
      return res.status(500).json({ error: 'Failed to authorize update upload operation' });
    }

    const savedHash = wedding.admin_password_hash || '';
    if (adminPassword !== savedHash) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }

    // Prevent direct modifications to critical system fields like id
    const safeUpdates = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.wedding_id;
    delete safeUpdates.guest_id;
    delete safeUpdates.created_at;

    // Update upload in Supabase using the Service Role client
    const { data, error: updateError } = await supabase
      .from('uploads')
      .update(safeUpdates)
      .eq('id', uploadId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update upload in Supabase:', updateError);
      return res.status(500).json({ error: 'Failed to update upload database row' });
    }

    return res.status(200).json({ success: true, upload: data });
  } catch (error: any) {
    console.error('Error updating upload settings:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
