import http from 'k6/http';
import { sleep, check } from 'k6';

// ─── K6 LOAD TEST CONFIGURATION ───
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Ramp-up to 50 virtual users
    { duration: '1m', target: 500 },   // Ramp-up and hold at 500 virtual users (high pressure)
    { duration: '2m', target: 500 },   // Keep running at 500 virtual users
    { duration: '30s', target: 0 },    // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete in under 2 seconds
  },
};

// ─── TARGET ENDPOINTS ───
// These fallback to your production domains, but can be overridden with env variables
const FRONTEND_URL = __ENV.TARGET_URL || 'https://acelyamuhammet.vercel.app';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://nunfsiqwazlmxbqmtjjf.supabase.co';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'sb_publishable_Agm5FnoFCdmUwnfiSzmqZg_UEuVsv8y';

export default function () {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  // 1. Simulate Guest loading the website's HTML page
  const pageRes = http.get(`${FRONTEND_URL}/wedding/acelya-muhammet-wedding`);
  check(pageRes, {
    'frontend page status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Simulate fetching Wedding Details from the database
  const weddingRes = http.get(
    `${SUPABASE_URL}/rest/v1/weddings?select=*&slug=eq.acelya-muhammet-wedding`,
    { headers }
  );
  check(weddingRes, {
    'db wedding settings loaded': (r) => r.status === 200,
  });
  sleep(0.5);

  // 3. Simulate loading Live Gallery Memories / Uploads (Heavy load simulation)
  const uploadsRes = http.get(
    `${SUPABASE_URL}/rest/v1/uploads?select=*&wedding_id=eq.wedding-demo-001&order=created_at.desc`,
    { headers }
  );
  check(uploadsRes, {
    'db gallery uploads loaded': (r) => r.status === 200,
  });

  // Extract the top 10 upload IDs to query comments & reactions (simulating true UI behaviour)
  let uploadIds = [];
  try {
    const uploads = JSON.parse(uploadsRes.body);
    if (Array.isArray(uploads) && uploads.length > 0) {
      uploadIds = uploads.slice(0, 10).map((u) => u.id);
    }
  } catch (e) {
    // Fail silently if parse fails
  }
  sleep(0.5);

  // 4. Simulate fetching reactions and comments for visible cards
  if (uploadIds.length > 0) {
    const idsFilter = `(${uploadIds.join(',')})`;

    // Get comments
    const commentsRes = http.get(
      `${SUPABASE_URL}/rest/v1/comments?select=*&upload_id=in.${idsFilter}`,
      { headers }
    );
    check(commentsRes, {
      'db comments loaded': (r) => r.status === 200,
    });

    // Get reactions
    const reactionsRes = http.get(
      `${SUPABASE_URL}/rest/v1/reactions?select=*&upload_id=in.${idsFilter}`,
      { headers }
    );
    check(reactionsRes, {
      'db reactions loaded': (r) => r.status === 200,
    });
  }

  // Simulate user browsing/staying on the page before leaving
  sleep(3);
}
