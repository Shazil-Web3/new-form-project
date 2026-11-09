/**
 * Ensure all expected columns exist across all tables
 * Comprehensive schema completion based on common application patterns
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const allColumns = [
  // Users table - authentication and profile
  { table: 'users', column: 'orgId', definition: 'INTEGER' },
  { table: 'users', column: 'name', definition: 'VARCHAR(255)' },
  
  // Documents table - numbering and metadata
  { table: 'documents', column: 'doc_number', definition: 'VARCHAR(255)' },
  { table: 'documents', column: 'project_code', definition: 'VARCHAR(255)' },
  { table: 'documents', column: 'cost_center', definition: 'VARCHAR(255)' },
  
  // Templates table - numbering and metadata  
  { table: 'templates', column: 'orgId', definition: 'INTEGER' },
  
  // Tasks table - additional metadata
  { table: 'tasks', column: 'updated_by', definition: 'INTEGER' },
  
  // Review tables - workflow
  { table: 'reviewstages', column: 'document_id', definition: 'VARCHAR(255)' },
  
  // LMS/Training tables - additional columns
  { table: 'lms_field_specialties', column: 'orgId', definition: 'INTEGER' },
  { table: 'lms_curricula', column: 'field_specialty_id', definition: 'INTEGER' },
  { table: 'lms_classes', column: 'curriculum_id', definition: 'INTEGER' },
];

async function ensureColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    let added = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const col of allColumns) {
      try {
        // Check if column exists
        const check = await client.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [col.table, col.column]
        );
        
        if (check.rows.length > 0) {
          skipped++;
          continue;
        }
        
        // Check if table exists first
        const tableCheck = await client.query(
          `SELECT table_name FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name = $1`,
          [col.table]
        );
        
        if (tableCheck.rows.length === 0) {
          console.log(`  ⚠️  Table ${col.table} does not exist - skipping ${col.column}`);
          continue;
        }
        
        // Add the column
        const sql = `ALTER TABLE "${col.table}" ADD COLUMN "${col.column}" ${col.definition}`;
        await client.query(sql);
        console.log(`  ✅ ${col.table}.${col.column}`);
        added++;
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('ERROR:  column')) {
          skipped++;
        } else {
          console.log(`  ❌ ${col.table}.${col.column}: ${err.message}`);
          errors++;
        }
      }
    }
    
    console.log(`\n📊 Results: ${added} added, ${skipped} skipped, ${errors} errors\n`);
    console.log('✨ Column verification complete!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

ensureColumns();
