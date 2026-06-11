/**
 * VowVault Plan B — Automated End-to-End API Integration Test Suite
 * Run via: node scripts/test-endpoints.js
 */

const BASE_URL = 'http://localhost:4000';
const WEDDING_ID = 'wedding-demo-001';
const SLUG = 'acelya-muhammet-wedding';
const ADMIN_PASSWORD = 'admin050505';

// Helper to generate a random UUID
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const testGuestId = uuidv4();
const testUploadId = uuidv4();

async function runTests() {
  console.log('🚀 Starting VowVault API Endpoint Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function assert(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. GET /api/health
  await assert('Health Check (GET /api/health)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const data = await res.json();
    if (data.status.toLowerCase() !== 'ok') throw new Error(`Expected status ok, got ${data.status}`);
  });

  // 2. GET /api/wedding
  await assert('Lookup Wedding Settings by Slug', async () => {
    const res = await fetch(`${BASE_URL}/api/wedding?slug=${SLUG}`);
    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const data = await res.json();
    if (data.id !== WEDDING_ID) throw new Error(`Expected ID ${WEDDING_ID}, got ${data.id}`);
    if (data.bride_name !== 'Açelya') throw new Error(`Expected bride name Açelya, got ${data.bride_name}`);
    if (data.admin_password_hash) throw new Error('Security risk: admin_password_hash must not be exposed in public settings response');
  });

  // 3. POST /api/guests
  await assert('Register Guest (POST /api/guests)', async () => {
    const res = await fetch(`${BASE_URL}/api/guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testGuestId,
        wedding_id: WEDDING_ID,
        first_name: 'Testy',
        last_name: 'McTest',
        table_number: '12',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (data.id !== testGuestId) throw new Error(`Expected guest ID ${testGuestId}, got ${data.id}`);
    if (data.table_number !== '12') throw new Error(`Expected table 12, got ${data.table_number}`);
  });

  // 4. GET /api/guests
  await assert('List Guests', async () => {
    const res = await fetch(`${BASE_URL}/api/guests?weddingId=${WEDDING_ID}`);
    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const data = await res.json();
    const guest = data.find(g => g.id === testGuestId);
    if (!guest) throw new Error('Registered guest not found in guests list');
  });

  // 5. POST /api/get-upload-url (Valid size/type)
  await assert('Get Upload URL for photo', async () => {
    const res = await fetch(`${BASE_URL}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `testing-${testUploadId}.jpg`,
        contentType: 'image/jpeg',
        weddingId: WEDDING_ID,
        fileSize: 1024 * 1024 * 5, // 5 MB (below 20MB limit)
        guestId: testGuestId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (!data.uploadUrl) throw new Error('Expected uploadUrl in response');
  });

  // 6. POST /api/get-upload-url (Size Limit rejection)
  await assert('Reject Photo exceeding 20 MB size limit', async () => {
    const res = await fetch(`${BASE_URL}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `too-big.jpg`,
        contentType: 'image/jpeg',
        weddingId: WEDDING_ID,
        fileSize: 1024 * 1024 * 21, // 21 MB (exceeds 20MB limit)
        guestId: testGuestId,
      }),
    });
    if (res.ok) throw new Error('Expected request to fail due to photo size exceeding 20 MB limit');
    const err = await res.json().catch(() => ({}));
    if (!err.error.includes('limit')) throw new Error(`Expected limit error message, got: ${err.error}`);
  });

  // 7. POST /api/uploads/metadata
  await assert('Create Upload Metadata in Database', async () => {
    const res = await fetch(`${BASE_URL}/api/uploads/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testUploadId,
        wedding_id: WEDDING_ID,
        guest_id: testGuestId,
        guest_name: 'Testy McTest',
        type: 'photo',
        storage_path: `testing-${testUploadId}.jpg`,
        public_url: `https://f003.backblazeb2.com/file/hslm-wedding-gallery/testing-${testUploadId}.jpg`,
        caption: 'Integration testing upload',
        is_approved: true,
        file_size: 1024 * 1024 * 5,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (data.id !== testUploadId) throw new Error(`Expected upload ID ${testUploadId}, got ${data.id}`);
  });

  // 8. GET /api/uploads
  await assert('List Uploads', async () => {
    const res = await fetch(`${BASE_URL}/api/uploads?weddingId=${WEDDING_ID}&type=photo`);
    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const data = await res.json();
    const upload = data.find(u => u.id === testUploadId);
    if (!upload) throw new Error('Created upload not found in public uploads list');
  });

  // 9. POST /api/comments
  await assert('Submit Comment on Upload', async () => {
    const res = await fetch(`${BASE_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: uuidv4(),
        upload_id: testUploadId,
        guest_id: testGuestId,
        guest_name: 'Testy McTest',
        text: 'Testing comments API endpoint!',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (data.upload_id !== testUploadId) throw new Error(`Expected upload ID ${testUploadId}, got ${data.upload_id}`);
    if (data.text !== 'Testing comments API endpoint!') throw new Error('Comment text mismatch');
  });

  // 10. GET /api/comments
  await assert('Fetch Comments for Upload', async () => {
    const res = await fetch(`${BASE_URL}/api/comments?uploadId=${testUploadId}`);
    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const data = await res.json();
    const comment = data.find(c => c.upload_id === testUploadId);
    if (!comment) throw new Error('Comment not found in comments response');
  });

  // 11. POST /api/reactions
  await assert('Toggle Reaction (Insert)', async () => {
    const res = await fetch(`${BASE_URL}/api/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: uuidv4(),
        upload_id: testUploadId,
        guest_id: testGuestId,
        type: 'heart',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (data.action !== 'added') throw new Error(`Expected reaction added action, got: ${data.action}`);
  });

  // 12. GET /api/reactions
  await assert('Fetch Reactions for Upload', async () => {
    const res = await fetch(`${BASE_URL}/api/reactions?uploadId=${testUploadId}`);
    if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
    const data = await res.json();
    const reaction = data.find(r => r.upload_id === testUploadId && r.guest_id === testGuestId);
    if (!reaction) throw new Error('Reaction not found in reactions list');
  });

  // 13. POST /api/admin/login
  await assert('Admin Login (POST /api/admin/login)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weddingId: WEDDING_ID,
        adminPassword: ADMIN_PASSWORD,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) throw new Error('Admin login returned success=false');
  });

  // 14. POST /api/delete-file
  await assert('Admin Clean Up: delete-file', async () => {
    const res = await fetch(`${BASE_URL}/api/delete-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: testUploadId,
        weddingId: WEDDING_ID,
        adminPassword: ADMIN_PASSWORD,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP Status ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) throw new Error('Expected deletion success=true');
  });

  console.log('\n======================================');
  console.log(`Test suite finished: Passed: ${passed}, Failed: ${failed}`);
  console.log('======================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
