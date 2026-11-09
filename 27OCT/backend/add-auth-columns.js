/**
 * Add missing authentication and user columns
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function addAuthColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    const columnsToAdd = [
      { table: 'users', column: 'password_hash', definition: 'VARCHAR(255)', reason: 'Hashed password for authentication' },
      { table: 'users', column: 'username', definition: 'VARCHAR(255)', reason: 'Username for login' },
      { table: 'users', column: 'first_name', definition: 'VARCHAR(255)', reason: 'User first name' },
      { table: 'users', column: 'last_name', definition: 'VARCHAR(255)', reason: 'User last name' },
      { table: 'users', column: 'middle_name', definition: 'VARCHAR(255)', reason: 'User middle name' },
      { table: 'users', column: 'gender', definition: 'VARCHAR(50)', reason: 'User gender' },
      { table: 'users', column: 'date_of_birth', definition: 'DATE', reason: 'User date of birth' },
      { table: 'users', column: 'job_title', definition: 'VARCHAR(255)', reason: 'Job title/position' },
      { table: 'users', column: 'department_id', definition: 'INTEGER', reason: 'Department reference' },
      { table: 'users', column: 'manager_id', definition: 'INTEGER', reason: 'Manager reference' },
      { table: 'users', column: 'is_active', definition: 'BOOLEAN DEFAULT TRUE', reason: 'Account active status' },
      { table: 'users', column: 'created_date', definition: 'TIMESTAMP DEFAULT NOW()', reason: 'Account creation date' },
      { table: 'users', column: 'updated_date', definition: 'TIMESTAMP DEFAULT NOW()', reason: 'Last update date' },
      { table: 'users', column: 'two_factor_enabled', definition: 'BOOLEAN DEFAULT FALSE', reason: '2FA status' },
      { table: 'users', column: 'two_factor_secret', definition: 'VARCHAR(255)', reason: '2FA secret key' },
      { table: 'users', column: 'last_password_change', definition: 'TIMESTAMP', reason: 'Last password change timestamp' },
      { table: 'users', column: 'password_reset_token', definition: 'VARCHAR(255)', reason: 'Password reset token' },
      { table: 'users', column: 'password_reset_expires', definition: 'TIMESTAMP', reason: 'Password reset token expiration' },
    ];

    let added = 0;
    let skipped = 0;
    
    for (const col of columnsToAdd) {
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
          console.log(`  ⚠️  Table ${col.table} not found - skipping ${col.column}`);
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

addAuthColumns();
