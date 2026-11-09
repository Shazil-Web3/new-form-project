/**
 * Final column fixes for complete schema
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
    
    // Add quiz_score column to lms_class_progress
    try {
      await client.query(`
        ALTER TABLE "lms_class_progress" ADD COLUMN "quiz_score" INTEGER DEFAULT 0
      `);
      console.log('✅ Added quiz_score column to lms_class_progress');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('❌ Error adding quiz_score:', e.message);
      } else {
        console.log('⊙ quiz_score column already exists');
      }
    }

    console.log('\n✨ Final schema fixes complete!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixColumns();
