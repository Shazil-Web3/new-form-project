/**
 * Final comprehensive schema fixes
 * Adds any remaining columns that might be causing runtime errors
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const finalColumns = [
  // LMS Progress table - all necessary columns for quiz/training tracking
  { table: 'lms_class_progress', column: 'quiz_passed', definition: 'BOOLEAN DEFAULT FALSE' },
  { table: 'lms_class_progress', column: 'quiz_attempts', definition: 'INTEGER DEFAULT 0' },
  
  // Refresh tokens - ensure all auth columns exist
  { table: 'refresh_tokens', column: 'user_agent', definition: 'TEXT' },
  { table: 'refresh_tokens', column: 'ip_address', definition: 'VARCHAR(45)' },
  
  // Users - any remaining auth-related columns
  { table: 'users', column: 'email_verified', definition: 'BOOLEAN DEFAULT FALSE' },
  { table: 'users', column: 'email_verified_at', definition: 'TIMESTAMP' },
  
  // Documents - additional tracking
  { table: 'documents', column: 'is_published', definition: 'BOOLEAN DEFAULT FALSE' },
  { table: 'documents', column: 'published_at', definition: 'TIMESTAMP' },
  
  // Templates - publishing
  { table: 'templates', column: 'is_published', definition: 'BOOLEAN DEFAULT FALSE' },
  { table: 'templates', column: 'published_at', definition: 'TIMESTAMP' },
];

async function fixSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    let added = 0;
    
    for (const col of finalColumns) {
      try {
        // Check if column exists
        const check = await client.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [col.table, col.column]
        );
        
        if (check.rows.length > 0) {
          console.log(`  ⊙ ${col.table}.${col.column}`);
          continue;
        }
        
        // Add the column
        const sql = `ALTER TABLE "${col.table}" ADD COLUMN "${col.column}" ${col.definition}`;
        await client.query(sql);
        console.log(`  ✅ ${col.table}.${col.column}`);
        added++;
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.log(`  ⚠️  ${col.table}.${col.column} - ${err.message}`);
        }
      }
    }
    
    console.log(`\n✨ Added ${added} final columns\n`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixSchema();
