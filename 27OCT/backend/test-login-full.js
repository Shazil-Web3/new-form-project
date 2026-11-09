/**
 * Full login test with detailed debugging
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
      console.log(`\n📊 Response Status: ${res.statusCode} ${res.statusMessage}`);
      console.log('📋 Response Headers:');
      console.log(JSON.stringify(res.headers, null, 2));
      
      try {
        const json = JSON.parse(data);
        console.log('\n✅ Response Body:');
        console.log(JSON.stringify(json, null, 2));
        
        if (res.statusCode === 200 && json.accessToken) {
          console.log('\n🎉 LOGIN SUCCESSFUL!');
          console.log(`Access Token: ${json.accessToken.substring(0, 50)}...`);
          console.log(`User: ${json.user.email}`);
        } else if (res.statusCode === 401) {
          console.log('\n❌ LOGIN FAILED (401): Invalid credentials or account issue');
          if (json.error) {
            console.log(`Error: ${json.error}`);
          }
          if (json.code) {
            console.log(`Code: ${json.code}`);
          }
        } else if (res.statusCode === 403) {
          console.log('\n❌ LOGIN FAILED (403): Access denied or expired');
          if (json.error) {
            console.log(`Error: ${json.error}`);
          }
        } else {
          console.log(`\n⚠️  Unexpected response code: ${res.statusCode}`);
        }
      } catch (e) {
        console.log('\n📄 Raw Response:');
        console.log(data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('\n❌ Connection Error:', e.message);
    console.error('Make sure the server is running on http://localhost:5000');
    process.exit(1);
  });

  console.log('🔄 Testing login...');
  console.log('📧 Email: admin@test.com');
  console.log('🔐 Password: Admin123!');
  console.log('⏳ Sending request to http://localhost:5000/api/users/login\n');

  req.write(postData);
  req.end();
}

testLogin();
