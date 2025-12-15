# 🎯 VOXANNE INBOUND AGENT - MVP FEATURES
## Dashboard-First Implementation (No Vapi Login Required)

**Reality Check:** You already have a working backend with Vapi integration. Everything should be controlled from YOUR dashboard at callwaitingai.dev.

---

## ✅ WHAT YOU ALREADY HAVE (From Summary)

Based on your production-ready system:

```
✅ Backend running on port 3001
✅ Frontend running on port 3000  
✅ Vapi integration fully functional
✅ WebSocket real-time transcripts
✅ Voice test working
✅ Agent configuration page
✅ Database with call_tracking, call_logs, call_transcripts
✅ Webhook handler receiving Vapi events
✅ Web voice bridge operational
```

---

## 🎯 MVP FEATURES NEEDED (Dashboard-First)

### **Feature 1: Inbound Call Management** ✅ CRITICAL

**What it does:**
Business owner sees ALL inbound calls in dashboard immediately after they happen.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ 📞 INBOUND CALLS (TODAY)                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [LIVE] +44 7XXX XXX XXX  |  2m 34s  |  In Progress │
│ Sarah speaking with caller about BBL pricing...     │
│                                                      │
│ ✅ +44 7XXX XXX XXX  |  4m 12s  |  Demo Booked     │
│ "Elite Aesthetics" - Scheduled for Dec 16, 2PM      │
│ [🎧 Play Recording]                                  │
│                                                      │
│ ⚠️ +44 7XXX XXX XXX  |  0m 45s  |  Hung Up         │
│ Caller hung up after hearing AI voice               │
│ [🎧 Play Recording]                                  │
│                                                      │
│ ✅ +44 7XXX XXX XXX  |  6m 03s  |  Qualified       │
│ "Dr. Michael Chen" - Needs follow-up call           │
│ [🎧 Play Recording] [📋 View Transcript]            │
└─────────────────────────────────────────────────────┘
```

**What's stored in database:**
- Call ID
- Caller phone number
- Call duration
- Call status (in-progress, completed, hung-up)
- Outcome (demo booked, qualified, not interested)
- Recording URL (from Vapi)
- Full transcript
- Timestamp

---

### **Feature 2: Call Recording Playback** ✅ CRITICAL

**What it does:**
Owner clicks "Play Recording" and hears the entire conversation.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ 🎧 CALL RECORDING                                    │
├─────────────────────────────────────────────────────┤
│ Caller: +44 7424 038250                              │
│ Duration: 4m 12s                                      │
│ Date: Dec 14, 2025 2:34 PM                           │
│ Outcome: Demo Booked ✅                               │
│                                                       │
│ [▶] ━━━━━●────────────────  2:34 / 4:12              │
│                                                       │
│ 🔊 Volume: ──────●──                                  │
│ ⏩ Speed: [1.0x] [1.5x] [2.0x]                       │
│                                                       │
│ [📥 Download MP3] [📋 View Transcript]               │
└─────────────────────────────────────────────────────┘
```

**Technical Requirements:**
- Get recording URL from Vapi webhook
- Store in `call_logs.recording_url`
- Audio player component in dashboard
- Download option (MP3 format)

---

### **Feature 3: Live Transcript Display** ✅ CRITICAL

**What it does:**
Owner sees transcript as call happens (real-time) and after call ends.

**Dashboard UI (During Call):**
```
┌─────────────────────────────────────────────────────┐
│ 💬 LIVE TRANSCRIPT (Updating...)                     │
├─────────────────────────────────────────────────────┤
│ [LIVE] Call with +44 7XXX XXX XXX                    │
│                                                       │
│ 14:23:12 [Sarah]: Good afternoon, this is Sarah      │
│          from CallWaiting AI. Thanks for calling.    │
│                                                       │
│ 14:23:18 [Caller]: Hi, I'm calling about the AI      │
│          receptionist. I run a clinic in London.     │
│                                                       │
│ 14:23:24 [Sarah]: Perfect. Are you the practice      │
│          owner or manager?                           │
│                                                       │
│ 14:23:27 [Caller]: I'm the owner...                  │
│          [Typing...]                                 │
└─────────────────────────────────────────────────────┘
```

**Dashboard UI (After Call):**
```
┌─────────────────────────────────────────────────────┐
│ 📋 FULL TRANSCRIPT                                   │
├─────────────────────────────────────────────────────┤
│ Call Duration: 4m 12s                                │
│ Outcome: Demo Booked ✅                               │
│                                                       │
│ [Search in transcript...]                            │
│                                                       │
│ 14:23:12 [Sarah]: Good afternoon, this is Sarah...   │
│ 14:23:18 [Caller]: Hi, I'm calling about...          │
│ ...                                                   │
│ [Full conversation]                                   │
│ ...                                                   │
│ 14:27:24 [Sarah]: Perfect, I've booked you for       │
│          December 16th at 2 PM.                      │
│                                                       │
│ [📥 Download TXT] [📧 Email Transcript]              │
└─────────────────────────────────────────────────────┘
```

---

### **Feature 4: Call Outcomes & Lead Status** ✅ HIGH PRIORITY

**What it does:**
System automatically categorizes each call and shows actionable next steps.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ 📊 CALL OUTCOMES (LAST 7 DAYS)                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ✅ Demo Booked: 12 calls                            │
│    → 8 scheduled, 4 awaiting confirmation           │
│                                                      │
│ 🟡 Qualified Lead: 18 calls                         │
│    → Needs follow-up call from you                  │
│                                                      │
│ 🟢 Information Only: 23 calls                       │
│    → "Just browsing" - added to nurture list        │
│                                                      │
│ 🔴 Not Interested: 5 calls                          │
│    → Not target market or wrong timing              │
│                                                      │
│ ⚠️ Hung Up: 3 calls                                 │
│    → Detected AI voice and disconnected             │
│                                                      │
│ Total Calls: 61                                      │
│ Conversion Rate: 19.7% (12/61 booked demo)          │
└─────────────────────────────────────────────────────┘
```

**How it works:**
- Vapi sends call summary in webhook
- Backend categorizes based on conversation content
- Dashboard displays actionable insights
- Owner knows exactly what to do next

---

### **Feature 5: Agent Configuration (From Dashboard)** ✅ HIGH PRIORITY

**What it does:**
Owner customizes Sarah's behavior without touching Vapi.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ ⚙️ AGENT CONFIGURATION                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🎤 Voice & Personality                              │
│ ├─ Voice: [British Female ▼]                        │
│ ├─ Tone: [Professional ▼] [Warm] [Clinical]        │
│ └─ Speed: [1.0x ──●────]                            │
│                                                      │
│ 📝 System Prompt (What Sarah Says)                  │
│ ┌────────────────────────────────────────────────┐ │
│ │ You are Sarah, a Medical Practice Operations   │ │
│ │ Consultant at CallWaiting AI...                │ │
│ │ [Full editable prompt]                         │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ 📚 Knowledge Base                                    │
│ ├─ ✅ Product Guide (pricing, features)             │
│ ├─ ✅ Case Studies (3 client stories)               │
│ ├─ ✅ Objection Handling                             │
│ └─ [+ Upload New Document]                          │
│                                                      │
│ 🛡️ Safe Mode Settings                               │
│ ├─ ✅ Never give medical advice (LOCKED)            │
│ ├─ ✅ Escalate emergencies immediately              │
│ └─ ✅ Record all calls for compliance               │
│                                                      │
│ [💾 Save Changes] [🧪 Test Agent]                   │
└─────────────────────────────────────────────────────┘
```

**Changes sync to Vapi automatically via API.**

---

### **Feature 6: Quick Actions & Follow-Ups** ✅ MEDIUM PRIORITY

**What it does:**
Owner can take action directly from call log.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ 📞 CALL DETAILS                                      │
├─────────────────────────────────────────────────────┤
│ Dr. Michael Chen - Elite Aesthetics London           │
│ +44 7424 038250                                       │
│ Duration: 4m 12s                                      │
│ Status: Qualified Lead 🟡                            │
│                                                       │
│ 📝 Sarah's Summary:                                  │
│ "Clinic owner, 50+ calls/day, currently missing     │
│  15% of calls. Interested in Growth plan. Main      │
│  concern: patient acceptance of AI. Wants demo."     │
│                                                       │
│ 🎯 Recommended Actions:                              │
│ [📅 Book Demo]  [📧 Send Case Studies]              │
│ [📞 Call Back]  [💬 Send SMS]                        │
│                                                       │
│ 🎧 Recording & Transcript:                           │
│ [▶ Play Call] [📋 View Transcript] [📥 Download]    │
└─────────────────────────────────────────────────────┘
```

---

### **Feature 7: Performance Analytics** ✅ MEDIUM PRIORITY

**What it does:**
Owner sees how Sarah is performing as a sales agent.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ 📊 SARAH'S PERFORMANCE (LAST 30 DAYS)               │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Total Calls: 247                                     │
│ Avg Duration: 4m 38s                                 │
│ Answer Rate: 100% (never misses)                     │
│                                                      │
│ 🎯 Conversion Metrics:                               │
│ ├─ Demo Booking Rate: 42% (104/247)                 │
│ ├─ Qualification Rate: 78% (193/247)                │
│ ├─ Objection Resolution: 71%                        │
│ └─ Call Abandonment: 3% (hung up after AI detect)   │
│                                                      │
│ 💰 Revenue Impact:                                   │
│ ├─ Demos Booked: 104                                │
│ ├─ Trials Started: 52 (50% show rate)               │
│ ├─ Paid Customers: 31 (60% conversion)              │
│ └─ Revenue Generated: £268,900                       │
│                                                      │
│ 📈 Trending:                                         │
│ Booking rate up 8% this week ↗                      │
│                                                      │
│ [📥 Download Report] [📧 Email Summary]             │
└─────────────────────────────────────────────────────┘
```

---

### **Feature 8: Call Routing & Hours** ✅ LOW PRIORITY (MVP)

**What it does:**
Owner controls when Sarah answers vs. when calls go to staff.

**Dashboard UI:**
```
┌─────────────────────────────────────────────────────┐
│ 📞 CALL ROUTING SETTINGS                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🕐 Operating Hours:                                  │
│ Monday - Friday: 9:00 AM - 6:00 PM                   │
│ Saturday: 10:00 AM - 2:00 PM                         │
│ Sunday: Closed                                       │
│                                                      │
│ 🤖 When to use Sarah:                                │
│ ○ Always (24/7)                                      │
│ ● During office hours only                          │
│ ○ After hours only                                  │
│ ○ Custom schedule                                   │
│                                                      │
│ 📞 Overflow Handling:                                │
│ When front desk can't answer:                       │
│ ✓ Route to Sarah immediately                        │
│                                                      │
│ 🚨 Emergency Escalation:                             │
│ Emergency keywords detected:                         │
│ → Transfer to: [+44 7424 038250]                    │
│                                                      │
│ [💾 Save Settings]                                   │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### **Backend Changes Needed:**

**1. Add Recording Storage**
```typescript
// backend/src/routes/webhooks.ts

// When Vapi webhook arrives with recording_url:
await supabase
  .from('call_logs')
  .update({
    recording_url: data.recording_url,
    recording_duration: data.duration,
    status: 'completed'
  })
  .eq('vapi_call_id', data.call_id);
```

**2. Add Call Outcome Detection**
```typescript
// backend/src/services/call-analyzer.ts (NEW)

function analyzeCallOutcome(transcript: string): CallOutcome {
  // Check for demo booking keywords
  if (transcript.includes('booked') || transcript.includes('calendar')) {
    return 'demo_booked';
  }
  
  // Check for qualification
  if (transcript.includes('owner') && transcript.includes('interested')) {
    return 'qualified_lead';
  }
  
  // Check for objections
  if (transcript.includes('not interested') || transcript.includes('no thanks')) {
    return 'not_interested';
  }
  
  return 'information_only';
}
```

**3. Add Agent Configuration API**
```typescript
// backend/src/routes/agent-config.ts (NEW)

router.put('/api/agent/config', async (req, res) => {
  const { systemPrompt, voice, knowledgeBase } = req.body;
  
  // Update Vapi assistant via API
  await vapiClient.updateAssistant(assistantId, {
    prompt: systemPrompt,
    voice: voice,
    // ... other settings
  });
  
  // Store in database for backup
  await supabase
    .from('agent_settings')
    .update({ system_prompt: systemPrompt })
    .eq('user_id', req.user.id);
  
  res.json({ success: true });
});
```

---

### **Frontend Components Needed:**

**1. Call Log Component**
```typescript
// src/app/dashboard/calls/page.tsx

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  
  useEffect(() => {
    // Fetch from backend
    fetch('/api/calls/recent')
      .then(r => r.json())
      .then(data => setCalls(data.calls));
  }, []);
  
  return (
    <div>
      {calls.map(call => (
        <CallCard 
          key={call.id}
          call={call}
          onPlayRecording={() => playRecording(call.recording_url)}
        />
      ))}
    </div>
  );
}
```

**2. Audio Player Component**
```typescript
// src/components/AudioPlayer.tsx

export function AudioPlayer({ recordingUrl }: { recordingUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  
  return (
    <div className="audio-player">
      <audio ref={audioRef} src={recordingUrl} />
      <button onClick={() => {
        if (playing) {
          audioRef.current?.pause();
        } else {
          audioRef.current?.play();
        }
        setPlaying(!playing);
      }}>
        {playing ? '⏸' : '▶'}
      </button>
      {/* Playback controls */}
    </div>
  );
}
```

**3. Agent Config Component**
```typescript
// src/app/dashboard/agent-config/page.tsx

export default function AgentConfigPage() {
  const [config, setConfig] = useState({
    systemPrompt: '',
    voice: 'british-female',
    knowledgeBase: []
  });
  
  async function saveConfig() {
    await fetch('/api/agent/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }
  
  return (
    <div>
      <textarea 
        value={config.systemPrompt}
        onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
      />
      <button onClick={saveConfig}>Save Changes</button>
    </div>
  );
}
```

---

## 🎯 MVP FEATURE PRIORITY

### **MUST HAVE (Week 1):**
1. ✅ **Inbound call list** - See all calls in dashboard
2. ✅ **Call recording playback** - Listen to conversations
3. ✅ **Full transcript display** - Read what was said
4. ✅ **Call outcomes** - Know which calls converted

### **SHOULD HAVE (Week 2):**
5. ✅ **Agent configuration** - Edit prompts from dashboard
6. ✅ **Quick actions** - Book demos, send follow-ups
7. ✅ **Performance analytics** - Track conversion rates

### **NICE TO HAVE (Week 3+):**
8. ✅ **Call routing** - Control when Sarah answers
9. ✅ **Live call monitoring** - Watch calls in real-time
10. ✅ **A/B testing** - Test different approaches

---

## 🚀 IMPLEMENTATION ROADMAP

### **Day 1-2: Recording Storage**
- Add recording URL capture in webhook
- Store in database
- Create audio player component
- Test playback in dashboard

### **Day 3-4: Call List & Details**
- Build call log page
- Add filtering (date, outcome, duration)
- Create call detail view
- Test with real calls

### **Day 5-6: Transcripts**
- Display transcripts in dashboard
- Add search functionality
- Export/download options
- Test accuracy

### **Day 7: Agent Configuration**
- Build config UI
- Connect to Vapi API
- Test prompt updates
- Validate changes work

---

## ✅ SUCCESS CRITERIA

**You'll know it's working when:**
- [ ] Every inbound call appears in dashboard within 5 seconds
- [ ] You can click "Play Recording" and hear full conversation
- [ ] Transcripts are readable and accurate
- [ ] Call outcomes are automatically detected
- [ ] You can edit Sarah's prompt from dashboard
- [ ] Changes sync to Vapi without logging in

---



