/**
 * Standalone Seeder and Workspace Repair CLI
 * Usage: npm run seed OR node src/seed-db.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { seedDefaults } = require('./src/config/seedDefaults');

async function main() {
  console.log('\n======================================================');
  console.log('  🚀 PRODOC WORKSPACE & DATABASE SEEDER / REPAIR TOOL');
  console.log('======================================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
      database: process.env.DB_NAME || 'custom_docx',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('📡 Connected to MySQL database successfully.');
    await seedDefaults(connection);
    console.log('\n✨ Database seeding and repair completed with 100% success!');
    console.log('All organizations, core users, starter templates, and sample documents are ready.\n');
  } catch (err) {
    console.error('❌ Seeder encountered error:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
