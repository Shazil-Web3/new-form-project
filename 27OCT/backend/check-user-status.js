const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  const r = await c.query('SELECT id, email, status, password_hash FROM users WHERE email=$1', ['admin@test.com']);
  console.log('User Status:');
  console.log(JSON.stringify(r.rows[0], null, 2));
  await c.end();
})();
