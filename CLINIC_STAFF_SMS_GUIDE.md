# 📱 CLINIC STAFF GUIDE: ENABLING SMS CONFIRMATIONS

**Version**: 1.0  
**Status**: ✅ Ready for Deployment  
**Last Updated**: January 19, 2026  

---

## What's New?

Starting now, **Voxanne can send automatic SMS confirmations** to patients when they book appointments with your voice AI.

**What this means**:
- Patient calls → Vapi books appointment → SMS sent automatically
- No manual SMS needed
- Patients get confirmation + appointment details
- Works 24/7 automatically

---

## Prerequisites

You'll need:
1. A **Twilio account** (SMS provider)
2. A **Twilio phone number** (where SMS comes from)
3. Your **Twilio credentials** (API keys)

### Step 1: Get Twilio Account

**Cost**: ~$0.0075 per SMS (very cheap)

**Sign up**:
1. Go to [twilio.com](https://www.twilio.com)
2. Create free trial account
3. Verify your phone number
4. You'll get $15 trial credit

**Get a Phone Number**:
1. In Twilio dashboard, click "Phone Numbers"
2. Click "Get started" or "Buy a number"
3. Choose country (US, Canada, etc.)
4. Buy a phone number (~$1/month)
5. This is where SMS will come FROM

### Step 2: Find Your Credentials

In Twilio dashboard:

1. **Account SID**: 
   - Click top-left "Account Info"
   - Copy the "Account SID"
   - Format: `ACxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **Auth Token**:
   - In Account Info, you'll see "Auth Token"
   - Copy it
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Your Twilio Phone**:
   - Click "Phone Numbers" → "Manage Numbers"
   - Find your purchased number
   - It looks like: `+1-XXX-XXX-XXXX`

**Keep these safe** - don't share publicly.

### Step 3: Enter Credentials in Voxanne

1. Log in to Voxanne founder console
2. Go to **Settings** → **Integrations** → **SMS**
3. Click **"Connect Twilio"**
4. Paste:
   - Account SID
   - Auth Token
   - Twilio Phone Number
5. Click **"Save & Test"**
6. Voxanne will send test SMS to your phone
7. If you get SMS → ✅ Success!

### Step 4: Enable SMS in Booking

1. In Voxanne dashboard, go to **Agent Config**
2. Find the booking agent
3. Look for **"SMS Confirmations"** section
4. Toggle **ON**
5. Click **"Save Agent"**

---

## What Happens Next

### Patient Books Appointment
1. Patient calls Vapi voice agent
2. Agent asks appointment details
3. Patient confirms booking
4. **✨ SMS is sent automatically ✨**

### Patient Receives SMS
Text message arrives with:
- Clinic name
- Appointment date & time
- Confirmation link (future)

**Example SMS**:
```
Appointment Confirmation: Smith Medical Clinic
Date: Tuesday, August 20, 2026
Time: 3:00 PM
Confirm: [link]
```

### Your Team Sees
In Voxanne dashboard → Appointments:
- SMS Status: ✅ Sent
- Time sent: 2:45 PM
- Patient confirmed: Yes/No

---

## Troubleshooting

### "SMS failed but appointment was created"
- ✅ This is OK - appointment is safe in database
- Check: Is your Twilio number valid?
- Check: Do you have SMS credits?
- Try: Send test SMS from Twilio dashboard

### "Twilio credentials not found"
- ✅ Credentials not saved yet
- Go to: Settings → Integrations → SMS
- Enter credentials again
- Click Save & Test

### "Patient didn't receive SMS"
- Check: Is patient phone number in correct format? (e.g., +1-XXX-XXX-XXXX)
- Check: Is patient in US/Canada? (Twilio region)
- Check: Is Twilio account in good standing?
- Try: Send test SMS manually from Twilio dashboard

### "Too many SMS being sent"
- Check: Do you have duplicate bookings?
- Check: Is SMS being sent multiple times per booking?
- Contact: Voxanne support (SMS bridge may have issue)

---

## Best Practices

### 1. Test Before Going Live
- Set up Twilio
- Enter credentials
- Book test appointment
- Verify SMS received
- Then enable for real appointments

### 2. Monitor SMS Cost
- Cost: ~$0.0075 per SMS
- 1000 appointments/month = ~$7.50
- Very affordable

### 3. Use Professional SMS Text
- Keep SMS under 160 characters (saves cost)
- Include clinic name
- Include appointment time
- Include confirmation link (when available)

### 4. Respect Patient Privacy
- Only send SMS to numbers that opted in
- Don't share Twilio credentials
- Don't expose phone numbers in logs

### 5. Track Delivery
- Check "SMS Status" in appointments list
- Monitor: sent | failed | bounced
- Alert if delivery rate drops below 95%

---

## FAQ

**Q: Is SMS secure?**  
A: Yes. Twilio is PCI-DSS compliant. Credentials are encrypted in Voxanne database.

**Q: Can patients opt out?**  
A: Yes (future feature). For now, SMS goes to number on appointment.

**Q: What if patient has international phone?**  
A: Twilio supports 200+ countries. Pricing varies by country.

**Q: Can we customize SMS text?**  
A: Future feature. For now, Voxanne sends default format.

**Q: How long does SMS take?**  
A: Usually 1-5 seconds after booking confirmed.

**Q: What if SMS fails?**  
A: Booking is still created. SMS just won't send. Appointment is safe.

**Q: Can we see SMS history?**  
A: Yes. In Appointments list, column "SMS Status" shows delivery status.

**Q: Do we need to manage Twilio separately?**  
A: Minimal. Just monitor credits once/month and recharge as needed.

---

## Support

### If SMS stops working
1. Check Twilio dashboard - is account in good standing?
2. Check Twilio credits - do you have balance?
3. Check credentials in Voxanne - are they current?
4. Restart agent: Save agent config again

### Get Help
- Email: support@voxanne.ai
- Check: PRODUCTION_READINESS_SMS_BRIDGE.md (technical details)
- Slack: Post in #sms-confirmations

---

## Quick Start Checklist

- [ ] Sign up for Twilio account
- [ ] Buy Twilio phone number
- [ ] Copy Account SID
- [ ] Copy Auth Token
- [ ] Enter credentials in Voxanne settings
- [ ] Click "Save & Test"
- [ ] Receive test SMS on your phone
- [ ] Enable SMS in Agent Config
- [ ] Save Agent
- [ ] Book test appointment
- [ ] Verify patient received SMS
- [ ] ✅ DONE! SMS confirmations live

---

## What's Next?

After SMS is working:
1. **Google Calendar Sync** (coming soon)
   - Automatically sync Vapi bookings to your Google Calendar
   - Prevent double-booking

2. **SMS Opt-out Management** (coming soon)
   - Let patients unsubscribe from SMS
   - TCPA compliance tools

3. **Custom SMS Templates** (coming soon)
   - Personalize SMS text
   - Add clinic logo/branding

---

## Technical Details

**For IT/Tech Staff**:

- **Backend Endpoint**: POST `/api/vapi/tools/bookClinicAppointment`
- **SMS Service**: BookingConfirmationService
- **Encryption**: AES-256-GCM per-organization
- **Credentials Storage**: customer_twilio_keys table (encrypted)
- **Failsafe**: Booking always succeeds, SMS failure is non-blocking
- **Multi-tenant**: Each clinic's SMS isolated by org_id

**Architecture**:
```
Vapi Call → Backend → [Atomic Booking] → [SMS Bridge] → Twilio → Patient
                       ✅ Always       → Optional      → May fail (booking succeeds anyway)
```

---

## Status

🟢 **SMS Bridge Production Ready**

All infrastructure verified and operational. Clinics can now enable SMS confirmations.

---

**Questions?** Contact Voxanne Support  
**Technical Issues?** See [PRODUCTION_READINESS_SMS_BRIDGE.md](PRODUCTION_READINESS_SMS_BRIDGE.md)  
**Implementation Date**: January 19, 2026
