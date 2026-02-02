# Leads Page User Guide

**Last Updated:** 2026-02-02
**Version:** 1.0

---

## What is the Leads Page?

The **Leads Page** ("Live Leads - Real-Time") is your central hub for managing and tracking all active leads with real-time scoring. It helps sales teams, clinic coordinators, and front desk staff manage daily lead follow-ups, make outbound calls, send SMS campaigns, and track the entire customer journey from first contact to conversion.

**Who Uses It:** Sales teams, clinic coordinators, front desk staff
**When to Use It:** Daily lead management, follow-up calls, SMS campaigns, lead qualification

---

## What Leads Are Displayed

### Default View

The Leads page displays **ALL contacts** for your organization, ordered by:
1. **Lead score** (high to low) - Higher scores appear first
2. **Last contact time** (oldest first) - Leads needing follow-up appear at the top

### Filtering Options

| Filter | What It Shows | Database Query |
|--------|--------------|----------------|
| **All Scores** | All leads regardless of score | No filter applied |
| **Hot (80+)** | High-conversion leads with score ≥ 80 | `WHERE lead_score >= 80` |
| **Warm (50-79)** | Medium-conversion leads with score 50-79 | `WHERE lead_score >= 50 AND lead_score < 80` |
| **Cold (<50)** | Low-conversion leads with score < 50 | `WHERE lead_score < 50` |

### Search Functionality

- **Searches:** Contact name and phone number (partial match)
- **Real-time:** Results update as you type
- **Case-insensitive:** Searches work regardless of capitalization

### Pagination

- **20 leads per page** (optimized for performance)
- **Previous/Next buttons** for easy navigation
- **Page number display** shows current position
- **Total count** shows how many leads match your filters

---

## Lead Scoring Algorithm

### How Scores Are Calculated (0-100 Scale)

Leads receive a score based on engagement signals from call transcripts:

```
Base Score: 50 points

+ High-Value Keywords: +40 max
  (e.g., "botox", "laser", "filler", "consultation", "booking")

+ Medium-Value Keywords: +20 max
  (e.g., "pricing", "book", "appointment", "availability")

+ Positive Sentiment: +30 points
  (detected from tone and language)

- Negative Sentiment: -20 points
  (detected from objections, hesitation)

+ Urgency Indicators: +30 points
  (e.g., "today", "ASAP", "this week", "urgent")

- Low-Urgency Indicators: -10 points
  (e.g., "maybe", "someday", "thinking about it")

Final Score: Capped at 0-100
```

### Tier Assignment

- **Hot (≥ 80):** 🔥 High conversion probability - immediate action recommended
- **Warm (50-79):** ⭐ Medium probability - follow-up within 24-48 hours
- **Cold (< 50):** ❄️ Low probability - long-term nurture campaign

---

## Lead Status Workflow

### Lifecycle Stages

```
new → contacted → qualified → booked → converted
  ↓
lost
```

### Status Meanings

| Status | Definition | Next Action |
|--------|-----------|-------------|
| **new** | Just created, not yet contacted | Make first contact call |
| **contacted** | We've reached out at least once | Qualify their interest level |
| **qualified** | Lead showed genuine interest | Schedule appointment |
| **booked** | Appointment scheduled | Send reminder, prepare for appointment |
| **converted** | Sale completed (terminal state) | No further action needed |
| **lost** | Deal fell through (terminal state) | Archive or revisit in 90 days |

---

## Understanding Lead Cards

### What Each Lead Card Shows

**Top Section:**
- **Lead Score Badge:** Color-coded pill with score (e.g., 🔥 Hot 85)
- **Lead Status Badge:** Current pipeline stage (e.g., "Qualified")

**Main Content:**
- **Contact Name:** Full name in large bold text
- **Phone Number:** With phone icon for quick reference
- **Services Interested:** Up to 3 tags with overflow indicator (e.g., "+2 more")

**Right Section:**
- **Last Contact Time:** Relative time display
  - "Just now" - contacted within last minute
  - "5m ago" - 5 minutes ago
  - "2h ago" - 2 hours ago
  - "3d ago" - 3 days ago
  - "Never" - no contact yet

**Action Buttons:**
- **Call Back:** Initiates outbound call via Vapi
- **SMS:** Opens modal to compose message
- **Book:** Marks lead as booked (only visible if not already booked/converted)
- **Lost:** Marks lead as lost (only visible if not already lost/converted)

---

## User Workflows

### Daily Workflow for Sales Teams

#### Morning Routine (9:00 AM)
1. Open Leads page
2. Filter by **"Hot (80+)"**
3. Review all hot leads without appointments today
4. Call back high-priority leads using "Call Back" button
5. Use "Book" button when they agree to appointment
6. Use "Lost" button if they decline

#### Mid-Day Follow-Up (1:00 PM)
1. Switch filter to **"Warm (50-79)"**
2. Send SMS to warm leads asking about interest
3. Call back warm leads who respond positively
4. Move qualified leads to "qualified" status

#### End-of-Day Cleanup (5:00 PM)
1. Review all "contacted" leads
2. Mark as "qualified" if they showed interest
3. Mark as "lost" if they're not interested
4. Schedule follow-up calls for tomorrow

---

## Call Back Button Workflow

### When to Use
Use when a lead expressed interest and you want to follow up immediately.

### What Happens (Step-by-Step)
1. **User clicks "Call Back" button**
2. **Button shows loading state** ("Calling..." with spinner)
3. **Backend validates:**
   - Outbound agent exists
   - Phone number is available
   - Contact phone is in E.164 format
4. **Backend creates call tracking record** (status='queued')
5. **Backend calls Vapi API** to initiate outbound call
6. **Vapi calls your org's Twilio number first** (agent joins)
7. **Then Vapi calls the lead's phone number** (lead joins)
8. **Call appears in Call Logs** within seconds
9. **Call transcript saved automatically** after call ends
10. **Lead score updated** based on conversation

### User Experience
- **Loading state:** Button shows "Calling..." with spinner
- **Your phone rings:** Vapi calling from org's Twilio number
- **You answer:** Hear "You're being connected..."
- **Lead's phone rings:** Lead sees your business number
- **Conversation begins:** Natural conversation flow
- **Call logged:** Automatically saved to Call Logs

### Configuration Requirements

For the Call Back button to work, you need:

1. **Outbound Agent Configured**
   - Go to Agent Configuration → Outbound tab
   - Configure agent settings (name, voice, system prompt)
   - Click "Save Agent"

2. **Twilio Phone Number Imported**
   - Go to Settings → Telephony
   - Click "Import Twilio Number"
   - Enter Twilio credentials

3. **Contact Phone in E.164 Format**
   - Must start with `+` and country code
   - Example (US): `+12125551234`
   - Example (UK): `+442071234567`

### Troubleshooting

**If Call Back button fails, you'll see one of these helpful guides:**

**"Outbound agent not configured"**
- Shows step-by-step instructions
- Button: "Go to Agent Configuration" (direct link)

**"No phone number available"**
- Shows Twilio import instructions
- Button: "Go to Agent Configuration" (to re-save agent)

**"Invalid phone format"**
- Shows E.164 format examples
- Lists valid vs. invalid formats
- Tip: Edit contact to add country code

---

## SMS Button Workflow

### When to Use
Use for gentle follow-up or appointment reminders.

### What Happens (Step-by-Step)
1. **User clicks "SMS" button**
2. **Modal opens** with message textarea
3. **User composes message** (character count shown)
4. **User clicks "Send"**
5. **Backend fetches org's Twilio credentials** from integrations table
6. **Backend sends SMS** via Twilio API
7. **Backend logs in sms_logs table** for audit trail
8. **Success toast appears:** "SMS sent successfully"

### Best Practices
- **Keep messages under 160 characters** (single SMS, lower cost)
- **Personalize with lead's name** (increases response rate)
- **Include call-to-action** (e.g., "Reply YES to book")
- **Avoid spammy language** (reduces carrier filtering)
- **Send during business hours** (9 AM - 5 PM local time)

### Example SMS Messages

**Appointment Reminder:**
```
Hi Sarah! This is Dr. Chen's office. You have a Botox consultation tomorrow at 2 PM. Reply YES to confirm or call us at (212) 555-1234.
```

**Follow-Up After Call:**
```
Hi Michael! Great talking to you today about our laser treatments. Here's the pricing PDF: [link]. Reply with any questions!
```

**Re-Engagement:**
```
Hi Emily! We haven't heard from you in a while. Our new patient special is 20% off your first treatment. Interested? Call us!
```

---

## Book Button Workflow

### When to Use
Use when a lead verbally agrees to an appointment during a call or chat.

### What Happens
1. **User clicks "Book" button**
2. **Frontend sends PATCH request** with `lead_status: 'booked'`
3. **Backend updates contact record** in database
4. **Button disappears** from UI (no longer shows on booked leads)
5. **Success toast appears:** "Lead marked as booked"

### Important Note
This button **only updates the lead status**. To actually create an appointment:
- **Option 1:** Use calendar integration (separate flow)
- **Option 2:** Manually create appointment in Appointments page

### When Button Is Hidden
The Book button does NOT appear for leads with status:
- `booked` (already booked)
- `converted` (deal closed)

---

## Lost Button Workflow

### When to Use
Use when a lead explicitly declines or stops responding after multiple attempts.

### What Happens
1. **User clicks "Lost" button**
2. **Frontend sends PATCH request** with `lead_status: 'lost'`
3. **Backend updates contact record** in database
4. **Button disappears** from UI
5. **Success toast appears:** "Lead marked as lost"

### Best Practice
Add a note explaining why the lead was marked as lost:
- "Not interested in pricing" - price objection
- "Already went to competitor" - lost to competition
- "No response after 5 attempts" - unresponsive
- "Not ready right now" - timing issue

**How to Add Notes:**
- Click on the lead card to open detail modal
- Scroll to Notes section
- Add your note
- Click "Save" (if available) or close modal

### When Button Is Hidden
The Lost button does NOT appear for leads with status:
- `lost` (already marked as lost)
- `converted` (deal closed, can't mark as lost)

---

## Lead Detail Modal

### How to Open
Click anywhere on a lead card (except action buttons) to open the detail modal.

### What's Included

**Top Section:**
- Contact name (large)
- Phone number (clickable if on mobile)

**Lead Score and Status:**
- Visual badges with color coding
- Current score and tier (Hot/Warm/Cold)
- Current status (new/contacted/qualified/etc.)

**Contact Information:**
- Phone number with icon
- Email address (if available)

**Services Interested:**
- All service tags (not limited to 3)
- Helps understand lead's needs

**Call History (Last 5 Calls):**
- Call date and time (formatted: "22 Jan, 14:30")
- Duration (e.g., "2m 45s")
- Transcript preview (first 100 characters)
- Click to view full transcript (if available)

**Appointment History:**
- Service type booked
- Scheduled date and time
- Status (scheduled/completed/cancelled)
- Color-coded badges

**Notes:**
- Any notes added by team members
- Displayed in dedicated section

**Modal Footer Actions:**
- **Call Now:** Same as "Call Back" button (with loading state)
- **Close:** Dismiss modal and return to leads list

---

## Performance & Technical Details

### Real-Time Updates
- **WebSocket integration:** Leads update automatically when:
  - New hot lead alert received
  - Contact updated in another session
  - Lead score changes after a call
- **No manual refresh needed** for most updates
- **Refresh button available** for force-refresh if needed

### Pagination Performance
- **Database indexes optimized** for fast pagination
- **20 leads per page** balances usability and performance
- **Average load time:** <500ms with proper indexing

### Search Performance
- **Real-time search** as you type
- **Debounced requests** to reduce server load
- **Searches both name and phone number** simultaneously

### Mobile Responsiveness
- **Fully responsive design** works on all screen sizes
- **Touch-friendly buttons** (44px minimum target size)
- **Optimized for mobile workflows** (common use case)

---

## Common Questions

### Q: Why doesn't the Call Back button work?
**A:** You need to complete these configuration steps:
1. Configure outbound agent in Agent Configuration
2. Import your Twilio phone number
3. Ensure contact phone is in E.164 format (+[country code][number])

The Call Back button will show you exactly which step is missing with helpful instructions.

### Q: How often are lead scores updated?
**A:** Lead scores are recalculated after every call. If a lead has a conversation that indicates higher interest, their score will increase within seconds of the call ending.

### Q: Can I change the lead scoring algorithm?
**A:** Currently, the lead scoring algorithm is standardized across all organizations. Custom scoring rules are on the roadmap for enterprise customers.

### Q: What happens if I click "Lost" by accident?
**A:** You can change the lead status back by clicking on the lead card, then manually updating the status (future feature). Currently, contact your admin to revert the change.

### Q: Can I export leads to CSV?
**A:** Lead export is on the roadmap. Currently, you can view and manage all leads within the dashboard.

### Q: Why do some leads show "Never" for last contact?
**A:** "Never" means this lead has not been contacted yet. These are typically new leads that just came in or imported contacts without call history.

### Q: Can I assign leads to specific team members?
**A:** Lead assignment is on the roadmap for team collaboration features. Currently, all team members with dashboard access can see and manage all leads.

### Q: How long are leads kept in the system?
**A:** Leads are kept indefinitely unless manually deleted by an admin. "Lost" leads remain visible but can be filtered out using status filters (future feature).

---

## Tips & Best Practices

### 🎯 Lead Prioritization Strategy

**High Priority (Call Today):**
- Hot leads (80+) with last contact > 24 hours ago
- Warm leads (50-79) who responded positively to SMS
- Any lead with status "qualified" and no appointment

**Medium Priority (Call This Week):**
- Warm leads (50-79) with last contact > 7 days ago
- Cold leads (< 50) who recently upgraded to warm
- Any lead who asked for a callback

**Low Priority (Long-term Nurture):**
- Cold leads (< 50) with multiple failed contact attempts
- Leads marked "contacted" but showing low interest
- Leads outside your service area (future filter)

### 📞 Call Back Best Practices

**Before Calling:**
1. Review lead's call history (click lead card)
2. Check services they're interested in
3. Prepare talking points based on previous conversations
4. Have calendar open to offer appointment times

**During Call:**
1. Reference previous conversation ("Last time we talked about...")
2. Address their specific interests (services they mentioned)
3. Overcome objections with empathy
4. Use booking tools during the call if they agree

**After Call:**
1. Lead status updates automatically based on conversation
2. Add notes if needed (future feature)
3. Send follow-up SMS with appointment details
4. Mark as "booked" if appointment scheduled

### 📱 SMS Campaign Strategies

**Re-Engagement Campaign (Monthly):**
- Target: Cold leads (< 50) last contacted > 30 days ago
- Message: "Hi [Name]! We've missed you. Here's a special offer just for you..."
- Expected response rate: 5-10%

**Appointment Reminder Campaign (Daily):**
- Target: Booked leads with appointments in next 24 hours
- Message: "Hi [Name]! Reminder: Your [Service] appointment is tomorrow at [Time]..."
- Expected confirmation rate: 80-90%

**Follow-Up Campaign (After Call):**
- Target: Qualified leads who need more information
- Message: "Hi [Name]! Here's the info we discussed: [Link]. Let me know if you have questions!"
- Expected response rate: 30-40%

### 🔍 Search Tips

**Search by Phone:**
- Search for last 4 digits: `1234`
- Search with country code: `+1212`
- Search with formatting: `(212) 555` (works even though stored as E.164)

**Search by Name:**
- Partial name works: `john` finds "John Smith"
- Last name works: `smith` finds "John Smith"
- Case doesn't matter: `JOHN` = `john` = `John`

### 📊 Using Filters Effectively

**Morning Workflow:**
1. Start with "Hot (80+)" - address high-priority leads first
2. Call all hot leads without appointments
3. Switch to "Warm (50-79)" - follow up on medium-priority
4. End with "All Scores" - check for any urgent messages

**Weekly Review:**
1. Filter "All Scores" - get big-picture view
2. Sort by last contact (oldest first)
3. Identify leads that need re-engagement
4. Create SMS campaign for stale leads

---

## Keyboard Shortcuts (Future Feature)

*Keyboard shortcuts are planned for a future release. Suggested shortcuts:*

- `Space` - Open selected lead detail modal
- `C` - Call back selected lead
- `S` - Send SMS to selected lead
- `B` - Mark selected lead as booked
- `L` - Mark selected lead as lost
- `/` - Focus search box
- `Esc` - Close open modal
- `↑` / `↓` - Navigate between leads
- `←` / `→` - Navigate pagination

---

## Related Pages

- **[Agent Configuration](/dashboard/agent-configuration)** - Configure outbound agent for Call Back button
- **[Call Logs](/dashboard/calls)** - View all calls including outbound calls to leads
- **[Appointments](/dashboard/appointments)** - Create and manage appointments
- **[Settings → Telephony](/dashboard/settings)** - Import Twilio phone number

---

## Support & Feedback

**Need Help?**
- Contact support: support@voxanne.ai
- Documentation: https://docs.voxanne.ai
- Feature requests: feedback@voxanne.ai

**Report a Bug:**
If the Leads page isn't working as expected:
1. Take a screenshot of the error
2. Note what you were trying to do
3. Email to support@voxanne.ai with subject "Leads Page Issue"

---

**Version History:**
- **v1.0 (2026-02-02):** Initial user guide created with comprehensive workflows, troubleshooting, and best practices
