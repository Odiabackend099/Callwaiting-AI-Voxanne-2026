# 📋 STAFF SOP: AI Booking System - Phase 1 Go-Live
**Effective Date**: 2026-01-18  
**Phase**: 1 of 4 (Booking Logic Only)  
**Status**: LIVE NOW

---

## 📢 WHAT IS HAPPENING

**Our new AI receptionist (Sarah) is now taking real bookings.**

Starting today, when patients call and request an appointment, the AI system will:
- ✅ Listen to the patient's requested time
- ✅ Check the database for conflicts
- ✅ Create the appointment in our system
- ✅ Confirm with the patient on the call

**Your job**: Make sure this flows smoothly to the doctor's calendar and the patient gets confirmed.

---

## 👥 YOUR RESPONSIBILITIES (Phase 1)

### 1. **Monitor New Bookings** 📊
**Frequency**: Every 15-30 minutes during business hours

**Where to check**:
- Supabase Dashboard → `leads` and `appointments` tables
- Or contact your admin for dashboard access

**What to look for**:
- New rows in `appointments` table with `status = 'confirmed'`
- Patient name, phone, email, scheduled time
- Example:
  ```
  ID: abc-123
  Patient: John Smith
  Phone: +1-555-123-4567
  Email: john@example.com
  Scheduled: 2026-01-20 14:00 UTC
  Status: confirmed
  ```

### 2. **Add to Doctor's Calendar** 📅
**Timing**: Within 5 minutes of booking appearing in system

**Steps**:
1. Open the doctor's Google Calendar
2. Create a new event
3. Fill in:
   - **Title**: `[Patient Name] - Appointment`
   - **Time**: From appointment `scheduled_at` time
   - **Duration**: 60 minutes (standard)
   - **Notes**: Patient phone number and email
4. Save and confirm

**Why**: This prevents double-booking on the doctor's personal calendar

### 3. **Call/Text Patient to Confirm** 📞
**Timing**: Within 10 minutes of booking

**Script**:
```
"Hi [Patient Name]! This is [Clinic Name]. 
We received your booking through our AI assistant for [Day], [Date], at [Time].
We've confirmed it on our end. See you then!"
```

**Why**: Patients expect confirmation. This builds trust and catches any mishaps.

---

## ✅ Daily Checklist

- [ ] Check for new bookings (morning, midday, end of day)
- [ ] Add each to doctor's calendar within 5 minutes
- [ ] Call/text patient to confirm within 10 minutes
- [ ] Monitor error logs if something feels wrong
- [ ] Report any issues to tech team

---

## 🚨 What If Something Goes Wrong?

### Issue: "I see a booking but the time doesn't make sense"
**Action**: 
1. Check patient's phone number - might be in wrong timezone
2. Call the patient to confirm they meant that time
3. If error, have them call back and re-book
4. Report to tech team

### Issue: "I see double bookings for the same time"
**STOP IMMEDIATELY**: This means the database protection failed
1. Reject all bookings for that time except the first one
2. Contact tech team with error code
3. Do not accept new bookings until fixed

### Issue: "AI is sending malformed dates (2027 instead of 2026)"
**Action**:
1. Patient can call back to re-book
2. Report to tech team for prompt fix
3. May need to update AI's system prompt

### Issue: "Appointment created but no patient contact info"
**Action**:
1. Don't add to calendar yet
2. Call clinic to get missing info
3. Update the appointment record in database
4. Then add to calendar

---

## 📊 Success Metrics (What We're Measuring)

| Metric | What It Means | Expected |
|--------|---------------|----------|
| **Bookings Created** | AI successfully captured intent | Increasing throughout day |
| **Zero Double-Bookings** | Database protection working | 100% (no duplicates) |
| **Patient Confirmation Rate** | Staff reached out quickly | >95% confirmed within 10 min |
| **Calendar Accuracy** | No missed appointments | 100% on doctor's calendar |
| **Patient Satisfaction** | Calls/texts received | Positive feedback |

---

## 🎯 Phase 2 Timeline

This manual process is **temporary**. Here's what's coming:

**This Week**:
- ✅ SMS confirmations go live
- Patients automatically get text: "Booking confirmed for [Time]"
- Staff still manually adds to calendar

**Next Week**:
- ✅ Google Calendar sync goes live
- Appointments automatically added to doctor's calendar
- Staff receives notification, verifies

**Result**: By end of next week, zero manual steps. Fully automated.

---

## 💡 Tips for Success

1. **Set Phone Reminders**: Set calendar reminder every 15 minutes to check for new bookings
2. **Batch Operations**: Check 3-4 bookings at once, then add all to calendar together
3. **Keep Phone Handy**: You'll be calling patients frequently - have their numbers ready
4. **Track Turnaround**: Note how long it takes you to confirm each booking. Goal: <10 minutes
5. **Report Issues**: If something feels wrong, tell tech team immediately

---

## 📞 Support

**Questions?**
- Tech Team: [your-tech-contact]
- Doctor/Manager: [your-manager-contact]
- Emergency: [emergency-contact]

**Logging Access**:
- Supabase Dashboard: [supabase-link]
- Login: [your-email]
- Password: [stored-in-company-vault]

---

## 📝 Acknowledgment

I acknowledge that I understand:
- [ ] The AI is now taking real bookings
- [ ] I need to monitor the database every 15-30 minutes
- [ ] I need to manually add to calendar and call patients
- [ ] This is Phase 1 - SMS/Calendar automation comes next week
- [ ] I will report issues immediately

---

**Signed**: ________________  
**Date**: ________________  
**Role**: ________________

---

**This is the moment it all becomes real. You've got this!** 🚀

Generated: 2026-01-18 19:12 UTC  
Phase: 1 of 4  
Status: LIVE
