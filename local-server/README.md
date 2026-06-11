# VowVault Plan B — Local PC Backend

A secure, isolated local PC backend utilizing Node.js/Express and PostgreSQL. This backend serves as a fallback (Plan B) for the current Supabase production stack without impacting any active production databases or Vercel configurations.

---

## Architecture Principle: Direct CDN Media URL (Zero Media Bandwidth)

Your local PC handles **metadata and API traffic only**. 
* **Media Uploads:** The browser uploads photos and videos directly to Backblaze B2 using presigned URLs.
* **Media Downloads/Loads:** The gallery/slideshow loads files directly from the Backblaze B2 CDN public URLs.
* **Zero proxying:** Media bytes never flow through your PC. The `/api/media` endpoint is a simple HTTP 302 redirect fallback.

---

## Prerequisites

1. **Node.js** (v18 or higher recommended)
2. **PostgreSQL** (v14 or higher recommended)
3. **npm** (v9 or higher)
4. **Cloudflare Tunnel** (`cloudflared` installed on your machine)

---

## 1. Local Database Setup

To install and initialize the database locally on your PC:

### A. Create the Database & User
Open the PostgreSQL command line client (`psql`) as the `postgres` superuser (or use pgAdmin) and run:

```sql
-- Create user with a secure password
CREATE USER vowvault WITH PASSWORD 'your_secure_password';

-- Create database owned by vowvault
CREATE DATABASE vowvault OWNER vowvault;

-- Connect to the new database
\c vowvault

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO vowvault;
```

### B. Run the Schema
Run `schema.sql` to create all tables, indexes, and insert the demo seed wedding.
If running via terminal:

```bash
# Connect as vowvault user to database vowvault and execute the schema (enter vowvault password when prompted)
psql -U vowvault -d vowvault -f schema.sql
```

*(Alternatively, copy and paste the contents of [schema.sql](file:///d:/TELE/project/VowVault%20Local-First%20Prototype/local-server/schema.sql) into pgAdmin or another GUI client connected to `vowvault` database and run it.)*

---

## 2. Server Installation

### A. Install Dependencies
Bypass execution policies on Windows PowerShell if standard commands fail:

```powershell
npm.cmd install
```

### B. Configure Environment Variables
Create a file named `.env` in the `local-server` directory (based on `.env.example`):

```env
# ─── PostgreSQL ───
DATABASE_URL=postgresql://vowvault:your_secure_password@localhost:5432/vowvault

# ─── Server ───
PORT=4000
# Comma-separated list of whitelisted CORS origins
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://localhost:4000

# ─── Backblaze B2 ───
B2_KEY_ID=your_backblaze_key_id
B2_APPLICATION_KEY=your_backblaze_application_key
B2_BUCKET_ID=your_backblaze_bucket_id
B2_BUCKET_NAME=your_backblaze_bucket_name
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com # Or your endpoint
B2_PUBLIC_BASE_URL=https://f005.backblazeb2.com/file/your-bucket # CDN base URL

# ─── Optional ───
ADMIN_SECRET=optional_admin_auth_bypass_secret
```

---

## 3. Running the Server

### Development Mode (with hot-reload)
```bash
npm.cmd run dev
```

### Production Build & Run
```bash
npm.cmd run build
npm.cmd start
```

---

## 4. Cloudflare Tunnel Guide

To expose your local backend securely over HTTPS so that Vercel or mobile guest devices can access it:

### Option A: Quick Tunnel for Local/Staging Testing (Recommended for testing)
You do not need a domain or configuration files for this. Simply run:
```bash
cloudflared tunnel --url http://localhost:4000
```
This will spin up a temporary, random public URL (e.g. `https://some-random-subdomain.trycloudflare.com`). Use this URL as your `VITE_API_BASE_URL` in the frontend `.env`.

### Option B: Permanent Named Production Tunnel
For a stable, permanent setup with your own domain (e.g., `api.yourdomain.com`):
1. **Download and Install:** Install `cloudflared` from Cloudflare.
2. **Dashboard Setup:** It is highly recommended to configure the tunnel directly via the **Cloudflare Zero Trust Dashboard** (Access -> Tunnels) for a web-based named tunnel setup.
3. **CLI Setup (Alternative):**
   * Login: `cloudflared tunnel login`
   * Create: `cloudflared tunnel create vowvault-api`
   * Route: `cloudflared tunnel route dns vowvault-api api.yourdomain.com`
   * Configure ingress routing in `~/.cloudflared/config.yml` to point to `http://localhost:4000`.
   * Run the tunnel: `cloudflared tunnel run vowvault-api`
4. **Update CORS:** Make sure to append your tunnel domain (e.g., `https://api.yourdomain.com` or the temporary `.trycloudflare.com` URL) to your local server's `.env` under `CORS_ORIGIN`.

---

## 5. PC Reliability Best Practices

For a wedding or event, ensure the server PC does not go offline:

* **Disable sleep mode:**
  1. Open Windows Settings -> System -> Power & battery.
  2. Set "Screen and sleep" to **Never** when plugged in.
* **Keep Plugged In:** Ensure the laptop/PC is running on AC power.
* **Use Ethernet:** Connect the PC via a physical network cable to the router for a stable internet connection.
* **Run with PM2:** Use a process manager to keep the server running and auto-restart it on crashes:
  ```bash
  npm install -g pm2
  pm2 start dist/server.js --name vowvault-api --restart-delay=3000
  pm2 save
  pm2 startup
  ```

---

## 6. Database Backups

### A. Cross-Platform Script
To perform a timestamped database backup containing all schema structures and table rows:
```bash
npm.cmd run backup-db
```
Dumps will be stored in `local-server/backups/`. The script automatically retains the last **10** backups.

### B. PowerShell Script
Alternatively, from PowerShell:
```powershell
.\scripts\backup.ps1
```

### C. Manual Database Export (After the event)
To extract all guest data, photos, messages, comments, and reactions:
```bash
pg_dump --format=custom --file=vowvault_wedding_final.dump vowvault
```

---

## 7. Rollback Plan (Switching back to Supabase)

If the local PC server fails, you can immediately restore the Supabase production environment:

1. **Vercel Env:** Go to Vercel Dashboard -> Settings -> Environment Variables. Remove the `VITE_API_BASE_URL` override (or set it to blank).
2. **Re-deploy:** Trigger a redeployment of your production site from the `main` branch:
   ```bash
   git checkout main
   ```
3. **Stop Local Server:** Terminate the local processes:
   ```bash
   pm2 stop vowvault-api
   ```
4. **Database Dump:** Save the final local database dump just in case:
   ```bash
   pg_dump --format=plain --file=vowvault_local_recovery.sql vowvault
   ```
