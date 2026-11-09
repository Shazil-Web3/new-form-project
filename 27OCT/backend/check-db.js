const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Existing tables:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    
    // Check for critical tables
    const criticalTables = ['users', 'organizations', 'documents', 'templates', 'tasks', 'refresh_tokens'];
    const existing = new Set(result.rows.map(r => r.table_name));
    
    console.log('\nCritical tables status:');
    criticalTables.forEach(table => {
      console.log(`  ${table}: ${existing.has(table) ? '✓' : '✗'}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
})();
