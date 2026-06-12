const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://vowvault:138905@127.0.0.1:5432/vowvault',
});

async function main() {
  await client.connect();
  console.log('Connected to database. Checking if thumbnail_url column exists...');
  
  // Check if column already exists
  const checkRes = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='uploads' and column_name='thumbnail_url';
  `);
  
  if (checkRes.rows.length > 0) {
    console.log('Column "thumbnail_url" already exists in table "uploads".');
  } else {
    console.log('Adding "thumbnail_url" column to table "uploads"...');
    await client.query('ALTER TABLE uploads ADD COLUMN thumbnail_url TEXT;');
    console.log('Successfully added "thumbnail_url" column.');
  }

  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
});
