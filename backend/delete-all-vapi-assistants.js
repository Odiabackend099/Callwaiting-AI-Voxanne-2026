const https = require('https');

function vapiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vapi.ai',
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + process.env.VAPI_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    console.log('🗑️  Listing all Vapi assistants...');
    const listRes = await vapiRequest('GET', '/assistant');
    
    if (listRes.status !== 200) {
      console.log('❌ Failed to list assistants:', listRes.status);
      console.log('Response:', listRes.body);
      process.exit(1);
    }

    if (!Array.isArray(listRes.body)) {
      console.log('❌ Unexpected response format');
      console.log('Response:', listRes.body);
      process.exit(1);
    }

    const assistants = listRes.body;
    console.log(`✅ Found ${assistants.length} assistants\n`);

    if (assistants.length === 0) {
      console.log('✅ Vapi dashboard is already clean!');
      process.exit(0);
    }

    console.log('🗑️  Deleting all assistants from Vapi...\n');
    
    let deleted = 0;
    for (const assistant of assistants) {
      try {
        const deleteRes = await vapiRequest('DELETE', `/assistant/${assistant.id}`);
        if (deleteRes.status === 200 || deleteRes.status === 204) {
          console.log(`✅ Deleted: ${assistant.name || 'Unknown'} (${assistant.id.substring(0, 12)}...)`);
          deleted++;
        } else {
          console.log(`❌ Failed to delete ${assistant.name || 'Unknown'}: ${deleteRes.status}`);
          console.log('   Response:', deleteRes.body);
        }
      } catch (err) {
        console.log(`❌ Error deleting ${assistant.name || 'Unknown'}: ${err.message}`);
      }
      // Rate limiting - small delay between deletions
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n✅ Deleted ${deleted}/${assistants.length} assistants from Vapi`);
    
    // Verify
    const verifyRes = await vapiRequest('GET', '/assistant');
    const remaining = Array.isArray(verifyRes.body) ? verifyRes.body.length : 0;
    console.log(`📊 Remaining assistants in Vapi: ${remaining}`);
    
    if (remaining === 0) {
      console.log('✅ Vapi dashboard is now clean!');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
