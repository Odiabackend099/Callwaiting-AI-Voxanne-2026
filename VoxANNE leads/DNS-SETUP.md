# DNS Setup for mail.callwaitingai.dev

## Step 1: Add DNS Records

Add these 4 records to your DNS provider (Vercel/Cloudflare):

| Type  | Name (Host)            | Value / Target                                      | TTL  |
|-------|------------------------|-----------------------------------------------------|------|
| CNAME | mail                   | eu.mail.zoho.com.                                   | 60   |
| TXT   | mail._domainkey        | [GET FROM ZOHO - see step 2]                        | 60   |
| TXT   | _dmarc.mail            | v=DMARC1; p=none; rua=mailto:dmarc@callwaitingai.dev | 60   |
| TXT   | zoho-verification      | [GET FROM ZOHO - see step 2]                        | 60   |

## Step 2: Add Subdomain in Zoho

1. Log into <https://mail.zoho.com>
2. Go to **Control Panel → Domains → Add Domain/Subdomain**
3. Enter: **mail.callwaitingai.dev**
4. Zoho will show you:
   - DKIM record (for `mail._domainkey`)
   - Verification TXT record (for `zoho-verification`)
5. Copy these values into your DNS (step 1)
6. Click "Verify" in Zoho
7. Wait 2-10 minutes for DNS propagation

## Step 3: Create Email Account

In Zoho → Mail Accounts → Add Mail Account:

- Email: **<outreach@mail.callwaitingai.dev>**
- Set as default for cold campaigns

## Step 4: Generate App Password

1. Go to Zoho → Security → App Passwords
2. Create new password for "Outreach Script"
3. Copy the password
4. Update `outreach-sender.js` line 28:

   ```js
   pass: 'YOUR_NEW_APP_PASSWORD_HERE'
   ```

## Step 5: Update Script Config

In `outreach-sender.js`, update lines 26-28:

```js
auth: {
    user: 'outreach@mail.callwaitingai.dev',
    pass: 'YOUR_NEW_APP_PASSWORD_HERE'
}
```

## Step 6: Verify Setup

Run this test:

```bash
cd "/Users/mac/Desktop/consultflow AI/Roxan leads Config"
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtp.zoho.eu',
  port: 587,
  secure: false,
  auth: { user: 'outreach@mail.callwaitingai.dev', pass: 'YOUR_PASSWORD' }
});
t.verify().then(() => console.log('✅ SMTP OK')).catch(e => console.error('❌', e.message));
"
```

## Complete

Your cold emails will now send from:

- **From:** <outreach@mail.callwaitingai.dev>
- **Reply-To:** <support@callwaitingai.dev>

Main domain (callwaitingai.dev) stays pristine for customers.
