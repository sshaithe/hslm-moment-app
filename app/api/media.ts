import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
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

// Initialize S3 client for Backblaze B2
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

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get filename from query (e.g. ?file=uploads/uuid.jpg)
  const { file } = req.query;

  if (!file) {
    return res.status(400).json({ error: 'Missing file query parameter' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || '',
      Key: file,
    });

    const response = await s3Client.send(command);

    // Set aggressive cache control for performance
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Copy content headers from S3 response
    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }

    // Stream response body
    if (response.Body) {
      if (response.Body instanceof Readable) {
        response.Body.pipe(res);
      } else {
        // Node compatibility for other stream types (e.g. browser ReadableStream)
        const buffer = await response.Body.transformToByteArray();
        res.end(Buffer.from(buffer));
      }
    } else {
      res.status(404).end();
    }
  } catch (error: any) {
    console.error(`Error proxying media file "${file}":`, error);
    res.status(404).json({ error: 'File not found' });
  }
}
