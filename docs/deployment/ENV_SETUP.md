# Environment Variables Setup Guide

## Resend API Key (for ROI Report Emails)

1. Sign up at <https://resend.com>
2. Verify your sending domain (or use `onboarding@resend.dev` for testing)
3. Generate an API key from: <https://resend.com/api-keys>
4. Create a `.env.local` file in the root directory with:

```
RESEND_API_KEY=re_your_actual_api_key_here
```

## Testing the ROI Report Feature

Once you have your Resend API key:

1. Add it to `.env.local`
2. Restart the dev server
3. Trigger the exit-intent modal
4. Enter your email
5. Check your inbox for the professional ROI report

The report includes:

- Personalized revenue loss calculations
- Monthly and yearly projections
- Before/After comparison with Roxan
- Professional HTML design
- Direct CTA to book a demo
