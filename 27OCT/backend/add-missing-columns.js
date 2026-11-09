/**
 * Add Missing Columns to PostgreSQL Schema
 * Fixes column errors from migration failures
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const missingColumns = [
  // lms_class_progress table
  {
    table: 'lms_class_progress',
    column: 'completed_date',
    definition: 'TIMESTAMP',
    reason: 'Alias for completed_at'
  },
  // refresh_tokens table
  {
    table: 'refresh_tokens',
    column: 'access_expires_at',
    definition: 'TIMESTAMP',
    reason: 'Token access expiration'
  },
  // tasks table
  {
    table: 'tasks',
    column: 'start_date',
    definition: 'TIMESTAMP',
    reason: 'Task start date'
  },
  {
    table: 'tasks',
    column: 'progress',
    definition: 'INTEGER DEFAULT 0',
    reason: 'Task progress percentage'
  },
  {
    table: 'tasks',
    column: 'gantt_project_id',
    definition: 'INTEGER',
    reason: 'Gantt project reference'
  },
  {
    table: 'tasks',
    column: 'parent_task_id',
    definition: 'INTEGER REFERENCES "tasks" ("id") ON DELETE SET NULL',
    reason: 'Parent task for subtasks'
  },
  // users table
  {
    table: 'users',
    column: 'reports_to_id',
    definition: 'INTEGER REFERENCES "users" ("id") ON DELETE SET NULL',
    reason: 'Manager/supervisor reference'
  },
  // lms_field_specialties
  {
    table: 'lms_field_specialties',
    column: 'code',
    definition: 'VARCHAR(50)',
    reason: 'Specialty code'
  },
  {
    table: 'lms_field_specialties',
    column: 'revision',
    definition: 'INTEGER DEFAULT 1',
    reason: 'Revision number'
  },
  // lms_curricula
  {
    table: 'lms_curricula',
    column: 'code',
    definition: 'VARCHAR(50)',
    reason: 'Curriculum code'
  },
  {
    table: 'lms_curricula',
    column: 'revision',
    definition: 'INTEGER DEFAULT 1',
    reason: 'Revision number'
  },
  // lms_classes
  {
    table: 'lms_classes',
    column: 'certificate_validity_months',
    definition: 'INTEGER DEFAULT 12',
    reason: 'Certificate validity period'
  },
  {
    table: 'lms_classes',
    column: 'retraining_interval_months',
    definition: 'INTEGER DEFAULT 24',
    reason: 'Retraining interval'
  },
  // lms_quizzes
  {
    table: 'lms_quizzes',
    column: 'questions_per_attempt',
    definition: 'INTEGER',
    reason: 'Number of questions'
  },
  {
    table: 'lms_quizzes',
    column: 'max_attempts',
    definition: 'INTEGER DEFAULT 3',
    reason: 'Maximum attempts'
  }
];

async function addMissingColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    console.log('📝 Adding missing columns...\n');
    
    let added = 0;
    let skipped = 0;
    
    for (const col of missingColumns) {
      try {
        // Check if column exists
        const check = await client.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [col.table, col.column]
        );
        
        if (check.rows.length > 0) {
          console.log(`  ⊙ ${col.table}.${col.column} (already exists)`);
          skipped++;
          continue;
        }
        
        // Add the column
        const sql = `ALTER TABLE "${col.table}" ADD COLUMN "${col.column}" ${col.definition}`;
        await client.query(sql);
        console.log(`  ✅ ${col.table}.${col.column} - ${col.reason}`);
        added++;
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  ⊙ ${col.table}.${col.column} (already exists)`);
          skipped++;
        } else if (err.message.includes('does not exist')) {
          console.log(`  ⚠️  ${col.table} table does not exist yet - skipping ${col.column}`);
        } else {
          console.log(`  ❌ ${col.table}.${col.column}: ${err.message}`);
        }
      }
    }
    
    console.log(`\n✨ Column additions complete: ${added} added, ${skipped} already existed\n`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addMissingColumns();
