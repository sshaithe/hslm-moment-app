const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://vowvault:138905@localhost:5432/vowvault'
});

client.connect()
  .then(async () => {
    await client.query("UPDATE weddings SET wedding_date = '2026-06-13' WHERE id = 'wedding-demo-001'");
    console.log("SUCCESS: Wedding date updated to 2026-06-13!");
    client.end();
  })
  .catch(err => {
    console.error("ERROR:", err);
    client.end();
  });
