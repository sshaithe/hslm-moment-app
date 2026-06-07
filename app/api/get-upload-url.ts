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
    const { filename, contentType, weddingId } = req.body;

    if (!filename || !contentType || !weddingId) {
      return res.status(400).json({ error: 'Missing required parameters (filename, contentType, weddingId)' });
    }

    // ─── FILE TYPE VALIDATION ───
    const isImage = contentType.startsWith('image/');
    const isVideo = contentType.startsWith('video/');
    if (!isImage && !isVideo) {
      return res.status(400).json({ error: 'Invalid file type. Only images and videos are allowed.' });
    }

    // ─── CHECK IF UPLOADS ARE PAUSED ───
    const { data: wedding, error: dbError } = await supabase
      .from('weddings')
      .select('uploads_paused')
      .eq('id', weddingId)
      .single();

    if (dbError || !wedding) {
      console.error('Database error fetching wedding uploads_paused state:', dbError);
      return res.status(500).json({ error: 'Failed to verify wedding upload settings.' });
    }

    if (wedding.uploads_paused) {
      return res.status(403).json({ error: 'Uploads are currently paused by the administrator for this wedding.' });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || '',
      Key: filename,
      ContentType: contentType,
    });

    // Generate the presigned URL valid for 300 seconds (5 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
      unhoistableHeaders: new Set(['x-amz-checksum-crc32', 'x-amz-sdk-checksum-algorithm']),
    });

    return res.status(200).json({ uploadUrl });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
