# VowVault Plan B — Testing Checklist

Use this checklist to verify that the Plan B backend and frontend integration are working properly.

---

## 1. Backend Verification

### A. Health & Basic Setup
* [ ] **Server Starts:** Start the server with `npm.cmd run dev` or `npm.cmd start`. It should start on port 4000.
* [ ] **Check Health Endpoint:**
  ```bash
  curl http://localhost:4000/api/health
  ```
  Expected response: `{"status":"OK","timestamp":"..."}`
* [ ] **Database Connection Check:** If database connection fails, the health check will return an error or log `PostgreSQL connection pool failed` on startup. Ensure pg starts successfully.

### B. Route Specific Verification
* [ ] **Fetch Wedding Slug:**
  ```bash
  curl "http://localhost:4000/api/wedding?slug=acelya-muhammet-wedding"
  ```
  Expected: JSON object containing wedding metadata (including couples' names, date, venue, etc.). `admin_password_hash` must **not** be present in the output.
* [ ] **Anonymous Guest Rejection:**
  Attempt to request an upload URL without guest details when `require_guest_name=true`.
  ```bash
  curl -X POST -H "Content-Type: application/json" -d "{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"weddingId\":\"wedding-demo-001\",\"fileSize\":1000000,\"guestId\":\"anonymous\"}" http://localhost:4000/api/get-upload-url
  ```
  Expected: HTTP 400 or HTTP 403 error due to anonymous upload restriction when guest name is required.
* [ ] **Media Redirect Check (Bandwidth Verification):**
  ```bash
  curl -I "http://localhost:4000/api/media?file=uploads/test.jpg"
  ```
  Expected: HTTP/1.1 **302 Found**, with `Location` header pointing to your Backblaze B2/CDN URL. Verify that it returns immediately without downloading the file payload onto the local server.

---

## 2. Frontend Integration Verification

Start the frontend server (e.g. `npm run dev` in the `app` directory) and verify the following user paths:

### A. Guest Flow
* [ ] **Join Wedding:** Join using the slug `/wedding/acelya-muhammet-wedding`. Provide a guest name.
* [ ] **Upload a Photo:** Upload a small test image (< 20 MB).
  * Check browser Developer Tools -> Network tab.
  * You should see a `POST /api/get-upload-url` request returning a Backblaze upload URL.
  * You should see a `PUT` request directly to `backblazeb2.com`. Verify that **no** media bytes are sent to the local server.
  * A `POST /api/uploads/metadata` request should follow, saving the record to the local database.
* [ ] **Upload a Video:** Upload a video (< 150 MB).
  * If the video is longer than 3 minutes, the frontend should reject it.
  * If valid, it should upload directly to Backblaze.
* [ ] **Limit Check:** Confirm that guest upload counts update and enforce the limit of 50 photos / 10 videos per guest.
* [ ] **View Gallery:** Confirm images load in the gallery.
  * Right-click an image -> "Open image in new tab".
  * Verify the URL starts with your Backblaze CDN domain, **not** localhost or your local server.
* [ ] **Interactive Elements:**
  * Toggle reactions (Hearts, Laughs, Wows).
  * Write comments and verify they display in the comments drawer.
  * Write a text/drawing message on the Guest Book wall.

### B. Admin Flow
* [ ] **Admin Login:** Go to `/admin` and log in using `admin050505`.
* [ ] **View Dashboard:** Verify that guest counts, total uploads, and reported items metrics display.
* [ ] **Upload Moderation:**
  * Toggle "Approve" / "Hide" on guest uploads.
  * Delete a photo and verify it gets removed from the local database and Backblaze B2.
* [ ] **Guest Moderation:** Ban a test guest and confirm they can no longer upload or interact.
* [ ] **Slideshow Screen:**
  * Launch the Slideshow.
  * Verify that new uploads automatically load after 15 seconds.
  * Inspect the Network tab: a polling request should execute every 15 seconds.
  * Hide the tab (switch tabs or minimize browser) and verify polling pauses. Focus the tab again and verify polling resumes.
