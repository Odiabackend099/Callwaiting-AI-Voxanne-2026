# Frontend Pages Quick Reference Guide

## File Locations

```
src/app/dashboard/
├── appointments/page.tsx      (Appointments Dashboard - 574 lines)
├── leads/page.tsx              (Leads Dashboard - 720 lines)
├── notifications/page.tsx      (Notifications Center - 435 lines)
└── calls/page.tsx              (Calls Dashboard - ENHANCED with 150 new lines)
```

## URL Routes

| Page | URL | Features |
|------|-----|----------|
| Appointments | `/dashboard/appointments` | Manage scheduled appointments |
| Leads | `/dashboard/leads` | Real-time lead scoring & management |
| Notifications | `/dashboard/notifications` | Notification center with filtering |
| Calls | `/dashboard/calls` | Recording actions (enhanced) |

## Key Features at a Glance

### Appointments Dashboard
```
GET /api/appointments?page=1&limit=20&status=pending&dateRange=week
- List view with 6 columns (Date, Service, Contact, Duration, Status, Actions)
- Filters: Status (4 options), Date Range (3 options), Search (name/phone)
- Modals: Detail view with Reschedule, Reminder SMS, Cancel buttons
- Real-time: WebSocket updates on appointment_created/updated
```

### Leads Dashboard
```
GET /api/contacts?page=1&limit=20&leadStatus=new&leadScore=hot&search=
- Card layout with Lead Score badges (Hot/Warm/Cold with icons)
- Summary stats: Total, Hot, Warm, Cold leads
- Quick actions: Call Back, Send SMS, Mark Booked, Mark Lost
- Detail modal: Call history, appointment history, notes
- Real-time: WebSocket hot_lead_alert events
```

### Notifications Center
```
GET /api/notifications?page=1&limit=50&status=unread&type=hot_lead
- Notification list with type-based color coding
- Filters: Unread toggle, Type dropdown (5 types)
- Actions: Click to read & navigate, Delete, Mark All Read
- Real-time: WebSocket notification events
```

### Call Recording Actions (NEW)
```
Recording action buttons (appears in call detail modal):
- Download: Saves MP3 file to device
- Share: Generates signed URL, copies to clipboard
- Add to CRM: Creates new contact from caller info
- Follow-up: Opens SMS composer modal
- Export: Downloads PDF transcript
```

## State Management Pattern

All pages follow this pattern:

```typescript
// Data state
const [data, setData] = useState<DataType[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Pagination state
const [currentPage, setCurrentPage] = useState(1);
const [totalItems, setTotalItems] = useState(0);

// Filter state
const [filterX, setFilterX] = useState('');
const [filterY, setFilterY] = useState('');
const [searchQuery, setSearchQuery] = useState('');

// Detail modal state
const [selectedItem, setSelectedItem] = useState<DetailType | null>(null);
const [showDetailModal, setShowDetailModal] = useState(false);
```

## API Call Pattern

All pages use `authedBackendFetch`:

```typescript
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

// GET with pagination & filters
const data = await authedBackendFetch<any>(`/api/endpoint?${params.toString()}`);

// POST
await authedBackendFetch(`/api/endpoint`, {
    method: 'POST',
    body: JSON.stringify({ ... })
});

// PATCH
await authedBackendFetch(`/api/endpoint/:id`, {
    method: 'PATCH',
    body: JSON.stringify({ ... })
});

// DELETE
await authedBackendFetch(`/api/endpoint/:id`, {
    method: 'DELETE'
});
```

## WebSocket Real-Time Update Pattern

All pages connect to WebSocket for live updates:

```typescript
useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'event_name') {
                fetchData(); // Refresh data
            }
        } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
        }
    };

    return () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    };
}, [fetchData]);
```

## Tailwind Styling Patterns

### Dark Mode
```tsx
// Light mode class, dark mode with dark:
<div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-50">
<span className="text-gray-600 dark:text-slate-400">Subtext</span>
</div>
```

### Badges
```tsx
<span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
    {icon}
    {label}
</span>
```

Status colors (green=confirmed, blue=pending, gray=completed, red=cancelled/lost, emerald=booked)

### Modals
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">

        {/* Content */}
        <div className="p-6 space-y-6">

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-end gap-3">
</div>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {/* Cards adjust from 1 col mobile → 2 col tablet → 4 col desktop */}
</div>
```

### Loading Spinner
```tsx
<div className="w-8 h-8 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-500 rounded-full animate-spin" />
```

### Icons (Lucide React)
```tsx
import { Phone, Calendar, Clock, Download, Share2, UserPlus, Mail, X, etc. } from 'lucide-react';

<Phone className="w-4 h-4" /> // Small icon
<Calendar className="w-6 h-6" /> // Medium icon
<AlertCircle className="w-12 h-12" /> // Large icon
```

## Common Functions Provided

### Formatters
```typescript
// Date/Time formatting
formatDateTime(dateString) → "10 Jan 2024, 14:30"
formatTimeAgo(dateString) → "2 hours ago"
formatDuration(seconds) → "45m 30s"

// Status/Badge colors
getStatusBadgeColor(status) → "bg-green-50 text-green-700 border-green-200"
getLeadScoreBadge(score) → { label, icon, color }
```

### Pagination
```typescript
const totalPages = Math.ceil(totalItems / itemsPerPage);

// Pagination buttons
<button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</button>
<button onClick={() => setCurrentPage(pageNum)}>1</button>
<button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
```

## Error Handling

All pages follow this pattern:

```typescript
try {
    const data = await authedBackendFetch(...);
    setData(data);
} catch (err: any) {
    setError(err?.message || 'Operation failed');
    console.error('Error:', err);
}

// Display error
{error && (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm">
        {error}
    </div>
)}
```

## Common Buttons

### Primary Action
```tsx
<button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors flex items-center gap-2">
    <Icon className="w-4 h-4" />
    Action
</button>
```

### Secondary Action
```tsx
<button className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
    Action
</button>
```

### Color-Coded Actions
```tsx
// Blue (Info/Details)
className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"

// Green (Success/Confirm)
className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"

// Orange (Warning/Caution)
className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300"

// Red (Danger/Delete)
className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"

// Purple (Special/CRM)
className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
```

## Testing Quick Commands

```bash
# Build test
npm run build

# Lint check
npm run lint

# Type check
npx tsc --noEmit

# Run development
npm run dev

# Browse to
http://localhost:3000/dashboard/appointments
http://localhost:3000/dashboard/leads
http://localhost:3000/dashboard/notifications
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Not authenticated" | Ensure user is logged in via AuthContext |
| API 404 errors | Check endpoint URLs match backend routes |
| WebSocket not connecting | Verify NEXT_PUBLIC_BACKEND_URL is set |
| Styles not applying | Clear .next folder and rebuild |
| Dark mode not working | Check tailwind.config.js has darkMode: 'class' |
| Type errors | Ensure interfaces match API response structure |

## Performance Tips

1. **Pagination**: Always limit data (20-50 per page)
2. **Filters**: Reset currentPage to 1 when filters change
3. **WebSocket**: Debounce frequent updates in real-time events
4. **Images**: Use lazy loading for avatars/thumbnails
5. **Modals**: Close detail modal when deleting/updating item

## Code Review Checklist

Before committing:
- [ ] All TypeScript types defined
- [ ] Error handling on all API calls
- [ ] Loading states while fetching
- [ ] Dark mode styles for all elements
- [ ] Mobile responsive (test on md: breakpoint)
- [ ] WebSocket cleanup on unmount
- [ ] No console errors in dev tools
- [ ] Pagination works with filters
- [ ] Modal opens/closes properly
- [ ] Color contrast meets accessibility standards

---

**Last Updated:** January 10, 2025
**Pages Status:** ✅ All 4 Complete and Ready
