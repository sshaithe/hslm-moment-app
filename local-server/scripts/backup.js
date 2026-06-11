#!/usr/bin/env node
/**
 * VowVault PostgreSQL Backup Script
 * Run via: npm run backup-db
 *
 * Creates a timestamped .sql dump in the backups/ directory.
 * Keeps the last 10 backups (deletes older ones automatically).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Generate filename with timestamp
const now = new Date();
const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `vowvault_${ts}.sql`;
const filepath = path.join(backupsDir, filename);

console.log(`\n📦 VowVault Database Backup`);
console.log(`   Timestamp: ${now.toLocaleString()}`);
console.log(`   Output:    ${filepath}\n`);

try {
  // Run pg_dump with the connection string
  execSync(`pg_dump "${DATABASE_URL}" --file="${filepath}" --format=plain --no-owner --no-acl`, {
    stdio: 'inherit',
    env: { ...process.env },
  });

  const stats = fs.statSync(filepath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Backup complete: ${filename} (${sizeMB} MB)`);

  // Keep only last 10 backups
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith('vowvault_') && f.endsWith('.sql'))
    .sort()
    .reverse();

  if (files.length > 10) {
    const toDelete = files.slice(10);
    toDelete.forEach((f) => {
      fs.unlinkSync(path.join(backupsDir, f));
      console.log(`   Removed old backup: ${f}`);
    });
  }

  console.log(`\n📁 Total backups: ${Math.min(files.length, 10)}\n`);
} catch (err) {
  console.error('\n❌ Backup FAILED:', err.message);
  console.error('Make sure pg_dump is in your PATH (installed with PostgreSQL).\n');
  process.exit(1);
}
