const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_expires_at" TIMESTAMP');
    console.log('✅ Added access_expires_at to users table');
    await client.end();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
