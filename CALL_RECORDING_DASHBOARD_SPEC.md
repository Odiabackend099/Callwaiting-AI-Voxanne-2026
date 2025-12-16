# Call Recording Dashboard - Complete Specification

## User Flow

### 1. Call List View (Main Dashboard)
**User Actions:**
- Navigate to `/dashboard/calls`
- See paginated list of all calls (20 per page)
- Filter by: date range, caller name, call status, duration
- Sort by: date (newest first), duration, caller name
- Click row to open call detail
- Click "Download" to export call as PDF
- Click "Delete" to remove call record

**Data Displayed:**
- Call date/time (formatted: "Dec 15, 8:45 PM")
- Caller name (from call metadata)
- Duration (formatted: "4m 32s")
- Call status (completed, missed, transferred)
- Recording available (✓ or ✗)
- Transcript available (✓ or ✗)

### 2. Call Detail Modal
**User Actions:**
- Click call row to open modal
- Play/pause recording with timeline scrubber
- Read transcript with sentiment highlighting
- View call metadata (phone number, duration, date, AI response quality)
- Export to PDF
- Close modal

**Data Displayed:**
- Recording player with waveform
- Full transcript with speaker labels (Caller / Voxanne)
- Sentiment indicators (positive 🟢, neutral ⚪, negative 🔴)
- Call metadata panel
- Action items extracted from call

### 3. Call Metadata
**Stored for each call:**
- call_id (UUID)
- org_id (UUID)
- phone_number (caller's number)
- caller_name (extracted from CRM or voicemail)
- call_date (timestamp)
- duration_seconds (integer)
- recording_url (Vapi storage URL)
- transcript (full text)
- sentiment_score (0-1, 0=negative, 1=positive)
- call_status (completed, missed, transferred, failed)
- vapi_call_id (reference to Vapi)
- created_at, updated_at

---

## Core Features

### Feature 1: Call List with Pagination & Filtering
**Backend Endpoint:** `GET /api/calls`
**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `startDate` (ISO string, optional)
- `endDate` (ISO string, optional)
- `status` (completed|missed|transferred, optional)
- `search` (caller name or phone, optional)
- `sortBy` (date|duration|name, default: date)

**Response:**
```json
{
  "calls": [
    {
      "id": "uuid",
      "phone_number": "+44...",
      "caller_name": "John Doe",
      "call_date": "2025-12-15T20:45:00Z",
      "duration_seconds": 272,
      "status": "completed",
      "has_recording": true,
      "has_transcript": true,
      "sentiment_score": 0.85
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

### Feature 2: Call Detail with Recording & Transcript
**Backend Endpoint:** `GET /api/calls/:callId`

**Response:**
```json
{
  "id": "uuid",
  "phone_number": "+44...",
  "caller_name": "John Doe",
  "call_date": "2025-12-15T20:45:00Z",
  "duration_seconds": 272,
  "status": "completed",
  "recording_url": "https://vapi-storage.com/...",
  "transcript": [
    {
      "speaker": "caller",
      "text": "Hi, I'd like to book a consultation",
      "timestamp": 0,
      "sentiment": "positive"
    },
    {
      "speaker": "voxanne",
      "text": "Great! I can help with that...",
      "timestamp": 3,
      "sentiment": "positive"
    }
  ],
  "sentiment_score": 0.85,
  "action_items": [
    "Book consultation for Dec 20",
    "Send pricing information"
  ]
}
```

### Feature 3: Sentiment Analysis
**Backend Logic:**
- Analyze each transcript segment using OpenAI
- Score: 0 (negative) to 1 (positive)
- Label: negative (< 0.4), neutral (0.4-0.6), positive (> 0.6)
- Store per-segment and overall score

### Feature 4: Export to PDF
**Backend Endpoint:** `POST /api/calls/:callId/export`
**Query:** `?format=pdf` or `?format=csv`

**PDF Contents:**
- Call header (date, duration, caller, status)
- Recording player (QR code linking to recording)
- Full transcript with sentiment colors
- Call metadata
- Action items

### Feature 5: Call Metrics & Analytics
**Backend Endpoint:** `GET /api/calls/analytics/summary`

**Response:**
```json
{
  "total_calls": 156,
  "completed_calls": 142,
  "missed_calls": 14,
  "average_duration": 245,
  "average_sentiment": 0.78,
  "calls_today": 12,
  "calls_this_week": 87,
  "calls_this_month": 156
}
```

---

## Database Schema

### calls table
```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  phone_number TEXT NOT NULL,
  caller_name TEXT,
  call_date TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  status TEXT CHECK (status IN ('completed', 'missed', 'transferred', 'failed')),
  recording_url TEXT,
  transcript JSONB,
  sentiment_score FLOAT,
  sentiment_label TEXT,
  vapi_call_id TEXT UNIQUE,
  action_items TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_sentiment CHECK (sentiment_score >= 0 AND sentiment_score <= 1)
);

CREATE INDEX idx_calls_org_date ON calls(org_id, call_date DESC);
CREATE INDEX idx_calls_status ON calls(org_id, status);
CREATE INDEX idx_calls_phone ON calls(org_id, phone_number);
```

---

## Implementation Order

1. ✅ Create database schema (calls table)
2. ⏳ Create backend routes:
   - GET /api/calls (list with filtering)
   - GET /api/calls/:callId (detail)
   - POST /api/calls/:callId/export (PDF/CSV)
   - GET /api/calls/analytics/summary
3. ⏳ Create frontend components:
   - CallListPage (table, filters, pagination)
   - CallDetailModal (player, transcript, metadata)
   - SentimentHighlight (color-coded transcript)
4. ⏳ Integrate Vapi webhook to store calls
5. ⏳ Add sentiment analysis service
6. ⏳ Test end-to-end

---

## UI Components

### CallListPage
- Header with title and "Export All" button
- Filter bar (date range, status, search)
- Table with columns: Date, Caller, Duration, Status, Recording, Transcript, Actions
- Pagination controls
- Loading states and error messages

### CallDetailModal
- Header with call info (date, duration, caller)
- 2-column layout:
  - Left: Recording player with waveform
  - Right: Transcript with sentiment colors
- Bottom: Action items and metadata
- Export button (PDF/CSV)
- Close button

### SentimentBadge
- Color-coded: 🟢 positive, ⚪ neutral, 🔴 negative
- Hover shows sentiment score (0.85)

---

## Success Criteria

- ✅ All calls from Vapi webhook stored in database
- ✅ Call list loads in < 1s with 100+ calls
- ✅ Filtering works (date, status, search)
- ✅ Recording plays with timeline scrubber
- ✅ Transcript displays with sentiment highlighting
- ✅ Export to PDF generates valid file
- ✅ Sentiment analysis accurate (> 80% accuracy)
- ✅ Mobile responsive (works on iPad)
- ✅ No console errors
- ✅ All features tested end-to-end
