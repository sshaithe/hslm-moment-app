import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Fallback to load env variables from .env.local in development if they are not loaded by the host
if (!process.env.S3_BUCKET_NAME) {
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
          // Remove wrapping quotes if present
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

// Initialize the S3 client for generic S3-compatible storage
const s3Client = new S3Client({
  region: 'global',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

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
    const { filename, adminPassword, weddingId, uploadId } = req.body;

    if (!weddingId || !uploadId) {
      return res.status(400).json({ error: 'Missing required parameters (weddingId, uploadId)' });
    }

    // ─── AUTHENTICATION CHECK ───
    const { data, error: dbError } = await supabase
      .from('weddings')
      .select('admin_password_hash')
      .eq('id', weddingId)
      .single();

    if (dbError || !data) {
      console.error('Database error fetching wedding admin password:', dbError);
      return res.status(500).json({ error: 'Failed to authorize delete operation' });
    }

    const savedHash = data.admin_password_hash || '';
    if (adminPassword !== savedHash) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }

    // 1. Delete physical object from Backblaze B2 (only if filename is provided)
    if (filename) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || '',
          Key: filename,
        });

        await s3Client.send(command);
        console.log(`Successfully deleted file from S3 Storage: ${filename}`);
      } catch (s3Error) {
        console.error(`Failed to delete S3 file ${filename}:`, s3Error);
        // Continue to delete db record anyway so we don't leave orphaned rows in DB
      }
    }

    // 2. Delete database row from Supabase uploads table using Service Role client
    const { error: deleteDbError } = await supabase
      .from('uploads')
      .delete()
      .eq('id', uploadId);

    if (deleteDbError) {
      console.error('Failed to delete upload row from Supabase:', deleteDbError);
      return res.status(500).json({ error: 'Failed to remove database row' });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting file from S3 Storage:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
