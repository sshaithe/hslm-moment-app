const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load env variables from .env.local
const envLocalPath = path.resolve(__dirname, '.env.local');
const envConfig = fs.readFileSync(envLocalPath, 'utf8');
const env = {};
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
    env[key] = value;
  }
});

const keyId = env.S3_ACCESS_KEY_ID;
const appKey = env.S3_SECRET_ACCESS_KEY;
const bucketName = env.S3_BUCKET_NAME;

// Step 1: Authorize account
function authorize() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const req = https.request({
      hostname: 'api.backblazeb2.com',
      path: '/b2api/v2/b2_authorize_account',
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

// Step 2: Get bucket ID by name
function getBucketId(auth, bucketName) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ accountId: auth.accountId, bucketName });
    // B2 v2 API uses auth.apiUrl directly
    const apiUrl = auth.apiUrl || (auth.apiInfo && auth.apiInfo.storageApi && auth.apiInfo.storageApi.apiUrl);
    const url = new URL(`${apiUrl}/b2api/v2/b2_list_buckets`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        const bucket = (parsed.buckets || []).find(b => b.bucketName === bucketName);
        if (!bucket) return reject(new Error('Bucket not found: ' + bucketName + ' | Response: ' + JSON.stringify(parsed)));
        resolve({ bucket, apiUrl });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Step 3: Update bucket CORS rules
function updateCorsRules(auth, { bucket, apiUrl }) {
  return new Promise((resolve, reject) => {
    const corsRules = [
      {
        corsRuleName: 'allowAll',
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        allowedOperations: [
          'b2_download_file_by_id',
          'b2_download_file_by_name',
          'b2_upload_file',
          'b2_upload_part',
          's3_delete',
          's3_get',
          's3_head',
          's3_post',
          's3_put'
        ],
        maxAgeSeconds: 3600
      }
    ];

    const body = JSON.stringify({
      accountId: auth.accountId,
      bucketId: bucket.bucketId,
      corsRules: corsRules
    });

    const url = new URL(`${apiUrl}/b2api/v2/b2_update_bucket`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Setting Backblaze B2 CORS rules for bucket:', bucketName);
  try {
    console.log('1. Authorizing account...');
    const auth = await authorize();
    console.log('   OK - Account ID:', auth.accountId);

    console.log('2. Looking up bucket ID for:', bucketName);
    const bucketResult = await getBucketId(auth, bucketName);
    console.log('   OK - Bucket ID:', bucketResult.bucket.bucketId);

    console.log('3. Updating CORS rules...');
    const result = await updateCorsRules(auth, bucketResult);
    if (result.corsRules) {
      console.log('\nSUCCESS! CORS rules updated:');
      console.log(JSON.stringify(result.corsRules, null, 2));
    } else {
      console.log('\nResponse:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err.message || err);
  }
}

run();
