/**
 * Fix remaining column issues
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function fixColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    // Add department column to users (not department_id)
    try {
      await client.query(`
        ALTER TABLE "users" ADD COLUMN "department" VARCHAR(255)
      `);
      console.log('✅ Added department column to users');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('❌ Error:', e.message);
      } else {
        console.log('⊙ department column already exists');
      }
    }

    // Add department column to invited_users
    try {
      await client.query(`
        ALTER TABLE "invited_users" ADD COLUMN "department" VARCHAR(255)
      `);
      console.log('✅ Added department column to invited_users');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('❌ Error:', e.message);
      } else {
        console.log('⊙ department column already exists in invited_users');
      }
    }

    // Add role column to invited_users
    try {
      await client.query(`
        ALTER TABLE "invited_users" ADD COLUMN "role" VARCHAR(255)
      `);
      console.log('✅ Added role column to invited_users');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('❌ Error:', e.message);
      } else {
        console.log('⊙ role column already exists in invited_users');
      }
    }

    // Add site column to invited_users
    try {
      await client.query(`
        ALTER TABLE "invited_users" ADD COLUMN "site" VARCHAR(255)
      `);
      console.log('✅ Added site column to invited_users');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('❌ Error:', e.message);
      } else {
        console.log('⊙ site column already exists in invited_users');
      }
    }

    console.log('\n✨ Schema fixes complete!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixColumns();
