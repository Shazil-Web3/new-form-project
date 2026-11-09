/**
 * Seed test data for development
 * Creates a test organization and user for login
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();

async function seedTestData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    // 1. Create test organization
    console.log('📋 Creating test organization...');
    const orgResult = await client.query(
      `INSERT INTO "organizations" (name, description, status) 
       VALUES ($1, $2, $3) 
       ON CONFLICT DO NOTHING 
       RETURNING id, name`,
      ['Test Organization', 'Development and testing organization', 'active']
    );
    
    let orgId;
    if (orgResult.rows.length > 0) {
      orgId = orgResult.rows[0].id;
      console.log(`✅ Created organization: ${orgResult.rows[0].name} (ID: ${orgId})`);
    } else {
      // Get existing org
      const existing = await client.query(
        `SELECT id FROM "organizations" WHERE name = 'Test Organization' LIMIT 1`
      );
      if (existing.rows.length > 0) {
        orgId = existing.rows[0].id;
        console.log(`✅ Using existing organization (ID: ${orgId})`);
      } else {
        console.log('❌ Could not create or find organization');
        process.exit(1);
      }
    }

    // 2. Create test user
    console.log('\n👤 Creating test user...');
    const email = 'admin@test.com';
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO "users" (
        organization_id, email, password, password_hash, 
        full_name, first_name, last_name, username, 
        is_admin, status, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, full_name`,
      [
        orgId,
        email,
        hashedPassword,
        hashedPassword,
        'Test Admin',
        'Test',
        'Admin',
        'admin',
        true,
        'active',
        true
      ]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`✅ Created test user: ${user.full_name} (${user.email})`);
    } else {
      console.log(`✅ Test user already exists: ${email}`);
    }

    // 3. Assign super_admin role if it exists
    console.log('\n🔐 Assigning admin role...');
    try {
      const userCheck = await client.query(
        `SELECT id FROM "users" WHERE email = $1`,
        [email]
      );
      
      if (userCheck.rows.length > 0) {
        const userId = userCheck.rows[0].id;
        
        const roleCheck = await client.query(
          `SELECT id FROM "roles" WHERE role_key = $1`,
          ['super_admin']
        );
        
        if (roleCheck.rows.length > 0) {
          const roleId = roleCheck.rows[0].id;
          
          await client.query(
            `INSERT INTO "user_roles" (user_id, role_id, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT DO NOTHING`,
            [userId, roleId]
          );
          console.log('✅ Assigned super_admin role');
        }
      }
    } catch (e) {
      console.log('⚠️  Could not assign role:', e.message);
    }

    console.log('\n📝 Test Data Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Organization: Test Organization (ID: ${orgId})`);
    console.log(`Email:        ${email}`);
    console.log(`Password:     ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Test data seeded successfully!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedTestData();
