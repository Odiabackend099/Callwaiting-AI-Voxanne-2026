#!/usr/bin/env node

/**
 * Find Orphaned VAPI Assistant
 * 
 * This script queries the VAPI API to list all assistants
 * and identifies which one is orphaned (not linked in database)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
});

const VAPI_API_KEY = envVars.VAPI_API_KEY || process.env.VAPI_API_KEY;

if (!VAPI_API_KEY) {
    console.error('ERROR: VAPI_API_KEY not found in .env.local or environment');
    process.exit(1);
}

console.log('Querying VAPI API for all assistants...\n');

const options = {
    hostname: 'api.vapi.ai',
    path: '/assistant',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`VAPI API Error (${res.statusCode}):`, data);
            process.exit(1);
        }

        try {
            const assistants = JSON.parse(data);

            console.log(`Found ${assistants.length} assistant(s):\n`);

            assistants.forEach((assistant, index) => {
                console.log(`Assistant ${index + 1}:`);
                console.log(`  ID: ${assistant.id}`);
                console.log(`  Name: ${assistant.name || 'Unnamed'}`);
                console.log(`  Created: ${assistant.createdAt || 'Unknown'}`);
                console.log(`  Model: ${assistant.model?.model || 'Unknown'}`);
                console.log('');
            });

            // Save to file for reference
            const outputPath = path.join(__dirname, 'vapi-assistants.json');
            fs.writeFileSync(outputPath, JSON.stringify(assistants, null, 2));
            console.log(`Full assistant data saved to: ${outputPath}`);

        } catch (error) {
            console.error('Error parsing response:', error.message);
            console.error('Raw response:', data);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error.message);
    process.exit(1);
});

req.end();
