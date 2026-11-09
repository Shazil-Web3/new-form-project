/**
 * Test login endpoint
 */

const http = require('http');

function testLogin() {
  const postData = JSON.stringify({
    email: 'admin@test.com',
    password: 'Admin123!'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/users/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`\n📊 Response Status: ${res.statusCode}`);
      console.log('📋 Response Headers:', JSON.stringify(res.headers, null, 2));
      
      try {
        const json = JSON.parse(data);
        console.log('\n✅ Response Body:');
        console.log(JSON.stringify(json, null, 2));
        
        if (res.statusCode === 200 && json.token) {
          console.log('\n🎉 LOGIN SUCCESSFUL!');
          console.log(`Token: ${json.token.substring(0, 50)}...`);
        } else if (res.statusCode === 401) {
          console.log('\n❌ LOGIN FAILED: Invalid credentials');
        } else {
          console.log(`\n⚠️  Unexpected response`);
        }
      } catch (e) {
        console.log('\n📄 Raw Response:');
        console.log(data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error:', e.message);
    console.error('Make sure the server is running on http://localhost:5000');
  });

  console.log('🔄 Testing login...');
  console.log('📧 Email: admin@test.com');
  console.log('🔐 Password: Admin123!');
  console.log('⏳ Sending request...\n');

  req.write(postData);
  req.end();
}

testLogin();
