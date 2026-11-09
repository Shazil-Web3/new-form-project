/**
 * Check and display user password info for debugging
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();

async function checkUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL\n');
    
    // Get user info
    const result = await client.query(
      `SELECT id, email, password, password_hash, full_name, is_admin FROM "users" WHERE email = $1`,
      ['admin@test.com']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User not found: admin@test.com');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('👤 User Found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Full Name: ${user.full_name}`);
    console.log(`   Is Admin: ${user.is_admin}`);
    console.log(`   Password Column: ${user.password ? 'Has value' : 'NULL'}`);
    console.log(`   Password Hash Column: ${user.password_hash ? 'Has value' : 'NULL'}`);
    
    // Test password comparison
    const testPassword = 'Admin123!';
    console.log(`\n🔐 Testing password: "${testPassword}"\n`);
    
    if (user.password_hash) {
      try {
        const matches = await bcrypt.compare(testPassword, user.password_hash);
        console.log(`✅ password_hash comparison: ${matches ? 'MATCH' : 'NO MATCH'}`);
      } catch (e) {
        console.log(`❌ password_hash comparison error: ${e.message}`);
      }
    }
    
    if (user.password) {
      try {
        const matches = await bcrypt.compare(testPassword, user.password);
        console.log(`✅ password comparison: ${matches ? 'MATCH' : 'NO MATCH'}`);
      } catch (e) {
        console.log(`❌ password comparison error: ${e.message}`);
      }
    }

    // Show hashes for debugging
    console.log('\n📊 Hash Details:');
    if (user.password_hash) {
      console.log(`   password_hash: ${user.password_hash.substring(0, 50)}...`);
    }
    if (user.password) {
      console.log(`   password: ${user.password.substring(0, 50)}...`);
    }
    
    // Re-hash the password to show correct hash
    console.log('\n🔄 Creating new hash for password...');
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log(`   New hash: ${newHash.substring(0, 50)}...`);
    console.log(`   Full: ${newHash}`);

    // Verify the new hash works
    const newVerify = await bcrypt.compare(testPassword, newHash);
    console.log(`   Verify new hash: ${newVerify ? '✅ WORKS' : '❌ FAILS'}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkUser();
