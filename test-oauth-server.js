const express = require('express');
const { getOAuthUrl } = require('./backend/src/services/google-oauth-service');

const app = express();
const port = 3002;

app.get('/', async (req, res) => {
  try {
    const orgId = '550e8400-e29b-41d4-a716-446655440000';
    const authUrl = await getOAuthUrl(orgId);
    res.send(`
      <html>
        <body>
          <h1>Google OAuth Test</h1>
          <a href="${authUrl}">Connect Google Calendar</a>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
  console.log('Press Ctrl+C to stop');
});
