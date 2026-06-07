import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

// Initialize the S3 client for generic S3-compatible storage (Backblaze B2, etc.)
const s3Client = new S3Client({
  region: 'global',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  // Disable automatic CRC32 checksum - Backblaze B2 CORS does not allow these custom headers
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const { filename, contentType, weddingId, fileSize } = req.body;

    if (!filename || !contentType || !weddingId) {
      return res.status(400).json({ error: 'Missing required parameters (filename, contentType, weddingId)' });
    }

    if (fileSize === undefined || typeof fileSize !== 'number') {
      return res.status(400).json({ error: 'Missing or invalid parameter (fileSize)' });
    }

    // ─── SERVER-SIDE SIZE SECURITY CHECK ───
    const MAX_SIZE = 150 * 1024 * 1024;
    if (fileSize > MAX_SIZE) {
      return res.status(400).json({ error: `File size exceeds the limit of 150MB.` });
    }

    // ─── FILE TYPE VALIDATION ───
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ error: `Unsupported or invalid content type: ${contentType}` });
    }

    // ─── SERVER-SIDE UPLOAD SECURITY CHECK ───
    const { data: wedding, error: dbError } = await supabase
      .from('weddings')
      .select('uploads_paused')
      .eq('id', weddingId)
      .single();

    if (dbError || !wedding) {
      console.error('Server side auth check failed:', dbError);
      return res.status(404).json({ error: 'Wedding settings not found' });
    }

    if (wedding.uploads_paused) {
      return res.status(403).json({ error: 'Uploads are paused by the admin.' });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || '',
      Key: filename,
      ContentType: contentType,
    });

    // Generate the presigned URL valid for 900 seconds (15 minutes) to allow large video uploads
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900,
      unhoistableHeaders: new Set(['x-amz-checksum-crc32', 'x-amz-sdk-checksum-algorithm']),
    });

    return res.status(200).json({ uploadUrl });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
