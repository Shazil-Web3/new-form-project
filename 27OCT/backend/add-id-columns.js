/**
 * Add missing ID columns to templates and related tables
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function addIdColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    // Add id column to templates if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE "templates" ADD COLUMN "id" VARCHAR(255) UNIQUE
      `);
      console.log('✅ Added id column to templates');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('⊙ id column already exists in templates');
      } else {
        console.log('❌ Error adding id to templates:', e.message);
      }
    }

    // Add name column to templates if it doesn't exist (migrations reference it)
    try {
      await client.query(`
        ALTER TABLE "templates" ADD COLUMN "name" VARCHAR(255)
      `);
      console.log('✅ Added name column to templates');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('⊙ name column already exists in templates');
      } else {
        console.log('❌ Error adding name to templates:', e.message);
      }
    }

    // Add category_id to templates if needed
    try {
      await client.query(`
        ALTER TABLE "templates" ADD COLUMN "category_id" INTEGER
      `);
      console.log('✅ Added category_id column to templates');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('⊙ category_id column already exists in templates');
      } else {
        console.log('❌ Error adding category_id to templates:', e.message);
      }
    }

    // Add organizationfolders table if it doesn't exist
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "organizationfolders" (
          "id" SERIAL PRIMARY KEY,
          "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
          "name" VARCHAR(255),
          "created_at" TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Created organizationfolders table');
    } catch (e) {
      console.log('❌ Error creating organizationfolders:', e.message);
    }

    // Add template_categories table if it doesn't exist
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "template_categories" (
          "id" SERIAL PRIMARY KEY,
          "organization_id" INTEGER NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
          "name" VARCHAR(255),
          "created_at" TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Created template_categories table');
    } catch (e) {
      console.log('❌ Error creating template_categories:', e.message);
    }

    // Add missing columns to lms_class_progress for completeness
    try {
      await client.query(`
        ALTER TABLE "lms_class_progress" ADD COLUMN "progress_percent" INTEGER DEFAULT 0
      `);
      console.log('✅ Added progress_percent column to lms_class_progress');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.log('⚠️  Note on progress_percent:', e.message);
      }
    }

    console.log('\n✨ Schema additions complete!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addIdColumns();
