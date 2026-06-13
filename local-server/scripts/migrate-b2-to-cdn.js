const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://vowvault:138905@127.0.0.1:5432/vowvault'
});

async function main() {
  await client.connect();
  console.log('Connected to local database.');

  // 1. Update uploads table
  const resUploads = await client.query(`
    UPDATE uploads 
    SET public_url = REPLACE(public_url, 'https://f003.backblazeb2.com/file/hslm-wedding-gallery', 'https://cdn.acelyamuhammet.xyz/file/hslm-wedding-gallery')
    WHERE public_url LIKE '%f003.backblazeb2.com%'
  `);
  console.log(`Updated ${resUploads.rowCount} rows in uploads table.`);

  // 2. Update weddings table (banner, couple_photo, upload_placeholder_image)
  const resWeddings = await client.query(`
    UPDATE weddings
    SET 
      couple_photo = REPLACE(couple_photo, 'https://f003.backblazeb2.com/file/hslm-wedding-gallery', 'https://cdn.acelyamuhammet.xyz/file/hslm-wedding-gallery'),
      gallery_banner = REPLACE(gallery_banner, 'https://f003.backblazeb2.com/file/hslm-wedding-gallery', 'https://cdn.acelyamuhammet.xyz/file/hslm-wedding-gallery'),
      upload_placeholder_image = REPLACE(upload_placeholder_image, 'https://f003.backblazeb2.com/file/hslm-wedding-gallery', 'https://cdn.acelyamuhammet.xyz/file/hslm-wedding-gallery')
    WHERE 
      couple_photo LIKE '%f003.backblazeb2.com%' OR 
      gallery_banner LIKE '%f003.backblazeb2.com%' OR 
      upload_placeholder_image LIKE '%f003.backblazeb2.com%'
  `);
  console.log(`Updated ${resWeddings.rowCount} rows in weddings table.`);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
