import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
  endpoint: process.env.S3_ENDPOINT || 'https://s3.tebi.io',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

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
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || '',
      Key: filename,
    });

    await s3Client.send(command);
    console.log(`Successfully deleted file from S3 Storage: ${filename}`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting file from S3 Storage:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
