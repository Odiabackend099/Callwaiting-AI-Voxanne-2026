# Vapi Phone Number ID Setup

## Current Status

The `VAPI_PHONE_NUMBER_ID` environment variable has been added to `.env` but needs to be configured with the actual value from your Vapi dashboard.

## How to Get Your Vapi Phone Number ID

1. **Log in to Vapi Dashboard:** https://dashboard.vapi.ai
2. **Navigate to Phone Numbers:** Go to the "Phone Numbers" section
3. **Find Your Phone Number:** Locate the phone number you want to use for inbound calls
4. **Copy the ID:** The phone number ID will be displayed (format: typically a UUID or alphanumeric string)
5. **Update .env:** Replace `placeholder` in `VAPI_PHONE_NUMBER_ID=placeholder` with your actual ID

## Example

```bash
# Before
VAPI_PHONE_NUMBER_ID=placeholder

# After
VAPI_PHONE_NUMBER_ID=your-actual-phone-number-id-here
```

## Why This Is Needed

The `VAPI_PHONE_NUMBER_ID` is required for:
- **Inbound call routing** - Routes incoming calls to the correct Vapi assistant
- **Call tracking** - Associates calls with the correct phone number configuration
- **Webhook configuration** - Ensures webhooks are sent to the correct endpoint

## TestSprite Test Impact

Once you add the `VAPI_PHONE_NUMBER_ID`:
- **TC002** (Start Outbound Calls) should pass
- Current pass rate: 5/10 → Expected: 6/10+

## Current Environment Configuration

✅ **Configured:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `VAPI_API_KEY` - Vapi API key

⏳ **Needs Configuration:**
- `VAPI_PHONE_NUMBER_ID` - Get from Vapi dashboard
- `VAPI_ASSISTANT_ID` - Get from Vapi dashboard (if needed)

❌ **Not in Supabase:**
The Vapi phone number ID is not stored in the Supabase database. It must be configured directly in the `.env` file from your Vapi dashboard settings.
