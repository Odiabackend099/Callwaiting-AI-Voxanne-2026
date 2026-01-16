import express from 'express';
import { getOAuthUrl } from '../services/google-oauth-service';

const router = express.Router();

router.get('/', async (req, res) => {
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

export default router;
