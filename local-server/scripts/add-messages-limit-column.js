const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://vowvault:138905@127.0.0.1:5432/vowvault',
});

async function main() {
  await client.connect();
  console.log('Connected to database. Checking if max_messages_per_guest column exists in weddings table...');
  
  // Check if column already exists
  const checkRes = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='weddings' and column_name='max_messages_per_guest';
  `);
  
  if (checkRes.rows.length > 0) {
    console.log('Column "max_messages_per_guest" already exists in table "weddings".');
  } else {
    console.log('Adding "max_messages_per_guest" column to table "weddings"...');
    await client.query('ALTER TABLE weddings ADD COLUMN max_messages_per_guest INTEGER DEFAULT 5;');
    console.log('Successfully added "max_messages_per_guest" column.');
  }

  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
});
