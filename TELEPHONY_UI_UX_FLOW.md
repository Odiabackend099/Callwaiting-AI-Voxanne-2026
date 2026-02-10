# Telephony Page - User Experience Flow Diagrams

## State Diagram: Active Managed Numbers Section

```
                    Page Loads
                        |
                        v
                  fetchNumbers()
                        |
                  +-----+-----+
                  |     |     |
                  v     v     v
              SUCCESS ERROR LOADING
                |      |      |
        +-------+      |      +--------+
        |              |               |
        v              v               v
   Has Numbers?   Error State?   Loading Spinner
        |              |               |
        +--YES--+  error msg +---+  "Loading..."
        |       |         +     |
        |       |         |     |
        v       v         v     v
    +-----------+    +----------+
    | List View |    | Error    |
    +-----------+    | Banner   |
        |            | + Retry  |
        |            +----------+
        |
   NO (Empty)
        |
        v
    +-----------+
    | Empty     |
    | State     |
    | + CTA     |
    +-----------+
```

## User Flow: Delete Phone Number

```
┌────────────────────────────────────────────────────────────────────┐
│ MANAGED NUMBERS LIST                                               │
│                                                                    │
│ +1-555-123-4567    [Delete]                                       │
│ +1-555-987-6543    [Delete]                                       │
└────────────────────────────────────────────────────────────────────┘
        │
        │ User clicks [Delete] button
        │
        v
┌────────────────────────────────────────────────────────────────────┐
│ DELETE CONFIRMATION MODAL                                          │
│                                                                    │
│ ⚠️  Delete Phone Number?                                          │
│     +1-555-123-4567                                               │
│                                                                    │
│ This action cannot be undone. This will:                          │
│ • Release the number from Vapi                                    │
│ • Release the number from Twilio                                  │
│ • Remove all routing configurations                               │
│ • Disconnect any active calls                                     │
│                                                                    │
│     [Cancel]              [Delete Number]                         │
└────────────────────────────────────────────────────────────────────┘
        │                        │
  User clicks            User clicks
    Cancel              Delete Number
        │                        │
        v                        v
  Close Modal           API Call to Backend
        │              DELETE /api/managed-telephony/...
        │                        │
        │                   ┌────+────┐
        │                   │         │
        │                SUCCESS   FAILURE
        │                   │         │
        │                   v         v
        │              ✅ SUCCESS  ❌ ERROR
        │              TOAST       TOAST
        │                   │         │
        │                   v         v
        │              Refresh   No Change
        │              List      to List
        │                   │         │
        +───────────────────+─────────+
                            │
                            v
            ┌────────────────────────────┐
            │ LIST UPDATED/UNCHANGED     │
            │ (Toast auto-dismisses)     │
            └────────────────────────────┘
```

## Screen States

### State 1: Loading

```
┌─────────────────────────────────────────────────────────────┐
│ Active Managed Numbers                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      ⟳  Loading numbers...                 │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State 2: Empty (No Managed Numbers)

```
┌─────────────────────────────────────────────────────────────┐
│ Active Managed Numbers                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                      ☎️                                      │
│                                                             │
│        No Managed Numbers Yet                              │
│                                                             │
│  Buy a dedicated AI phone number to get                    │
│  started. We'll handle all the setup in                    │
│  minutes.                                                  │
│                                                             │
│           [🛒 Buy Your First Number]                        │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State 3: With Numbers

```
┌─────────────────────────────────────────────────────────────┐
│ Active Managed Numbers                    2 numbers        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ ☎️  +1-555-123-4567                  [🗑️  Delete]    │  │
│ │     US • active • Vapi ID: abc12345...               │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ ☎️  +1-555-987-6543                  [🗑️  Delete]    │  │
│ │     US • active • Vapi ID: def67890...               │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State 4: Error Loading

```
┌─────────────────────────────────────────────────────────────┐
│ Active Managed Numbers                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️  Failed to Load Numbers                                 │
│ Failed to fetch managed numbers: Network error             │
│                                                  [Retry]    │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ (Fallback to empty state shown below Retry button)   │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State 5: Delete Confirmation Modal

```
╔═════════════════════════════════════════════════════════════╗
║                                                             ║
║         ⚠️  Delete Phone Number?                           ║
║             +1-555-123-4567                                ║
║                                                             ║
║ This action cannot be undone. This will:                  ║
║ • Release the number from Vapi                            ║
║ • Release the number from Twilio                          ║
║ • Remove all routing configurations                       ║
║ • Disconnect any active calls                             ║
║                                                             ║
║                [Cancel]    [Delete Number]                ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝
```

### State 6: Success Toast (Bottom Right)

```
                              ┌──────────────────────────┐
                              │ ✓ Successfully deleted   │
                              │   +1-555-123-4567        │
                              │                        × │
                              └──────────────────────────┘
                              (Auto-dismisses in 5 sec)
```

### State 7: Error Toast (Bottom Right)

```
                              ┌──────────────────────────┐
                              │ ⚠️ Failed to delete number │
                              │   Error: API timeout      │
                              │                        × │
                              └──────────────────────────┘
                              (Dismissible, persistent)
```

## Component Hierarchy

```
TelephonyPage
├── Header
│   ├── Smartphone Icon
│   ├── "AI Forwarding Setup"
│   └── Description
│
├── Active Managed Numbers (ALWAYS RENDERED)
│   ├── Header
│   │   ├── Phone Icon + Title
│   │   └── Count (conditional)
│   │
│   ├── Error State (conditional on fetchError)
│   │   ├── AlertCircle Icon
│   │   ├── "Failed to Load Numbers"
│   │   ├── Error message
│   │   └── Retry Button
│   │
│   ├── Loading State (conditional on fetchingNumbers)
│   │   ├── Spinner Icon
│   │   └── "Loading numbers..."
│   │
│   ├── Empty State (conditional on no numbers)
│   │   ├── Phone Icon in circle
│   │   ├── "No Managed Numbers Yet"
│   │   ├── Description
│   │   └── "Buy Your First Number" Button
│   │
│   └── Numbers List (conditional on has numbers)
│       └── Number Cards (map)
│           ├── Phone Icon + Number + Metadata
│           └── Delete Button (with loading state)
│
├── Buy Managed Number Option
│   ├── ShoppingCart Icon
│   ├── Title (dynamic: "Buy Number" vs "Buy Another")
│   ├── Description
│   └── Buy Button
│
├── OR Separator
│
├── Setup Wizard + How It Works Sidebar
│   ├── TelephonySetupWizard
│   └── Info Cards
│       ├── How It Works
│       ├── No Porting Required
│       └── Your Caller ID
│
├── Delete Confirmation Modal (conditional on confirmDeleteNumber)
│   ├── Overlay Backdrop
│   ├── Modal Card
│   │   ├── Alert Icon + Title + Number
│   │   ├── Red Warning Box with Consequences
│   │   └── Button Group
│   │       ├── Cancel
│   │       └── Delete Number
│   └── Z-index: 50
│
├── Success Toast (conditional on deleteSuccess)
│   ├── CheckCircle Icon
│   ├── Success Message
│   └── Dismiss Button (×)
│
├── Error Toast (conditional on deleteError)
│   ├── AlertCircle Icon
│   ├── Error Message
│   └── Dismiss Button (×)
│
└── Buy Number Modal (conditional on showBuyNumberModal)
    └── BuyNumberModal component
```

## State Transitions

### On Initial Load
```
Initial State:
  managedNumbers = []
  fetchingNumbers = false
  fetchError = null
  deletingNumber = null
  confirmDeleteNumber = null
  deleteSuccess = null
  deleteError = null

Action: useEffect calls fetchManagedNumbers()

State Changes:
  fetchingNumbers = true
  (Render: Loading state)

Response from API:
  Success: numbers = [...]
    fetchingNumbers = false
    (Render: List OR Empty based on count)

  Error:
    fetchingNumbers = false
    fetchError = "Error message"
    (Render: Error banner + empty fallback)
```

### On Delete Click
```
Current: managedNumbers = [+1-555-123-4567, +1-555-987-6543]

User clicks delete on first number

State Change:
  confirmDeleteNumber = "+1-555-123-4567"
  (Render: Modal appears)

User clicks "Delete Number"

State Changes:
  deletingNumber = "+1-555-123-4567"
  (Button shows spinner)

API Call Initiates

API Success:
  - handleDeleteNumber completes
  - fetchManagedNumbers() called
  - List refreshes: managedNumbers = [+1-555-987-6543]
  - deleteSuccess = "Successfully deleted +1-555-123-4567"
  - confirmDeleteNumber = null
  - deletingNumber = null
  - setTimeout(() => deleteSuccess = null, 5000)
  (Render: List with 1 item, success toast)

API Failure:
  - deleteError = "Error message"
  - deletingNumber = null
  - managedNumbers unchanged
  (Render: List unchanged, error toast)
```

## Key Features Visualized

### Loading Skeleton
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    ⟳ Loading numbers...                │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Delete Button States

**Normal:**
```
[🗑️  Delete]
```

**Hover:**
```
[🗑️  Delete]  (darker background)
```

**Disabled (Deleting):**
```
[⟳ Deleting...]  (grayed out, spinner)
```

### Modal Appearance

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     ⚠️  Delete Phone Number?                          │
│         +1-555-123-4567                                │
│                                                         │
│     This action cannot be undone. This will:          │
│     • Release the number from Vapi                     │
│     • Release the number from Twilio                   │
│     • Remove all routing configurations                │
│     • Disconnect any active calls                      │
│                                                         │
│         [Cancel]  [Delete Number]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (>1024px)
- Section takes full width (max-w-5xl container)
- Modal centered on screen
- Toasts bottom-right with shadow

### Tablet (768-1024px)
- Section takes full width with padding
- Modal 90vw width, centered
- Toasts adjusted for smaller screen

### Mobile (<768px)
- Section takes full width with padding
- Modal full-width - 1rem padding on edges
- Toasts full-width - 1rem from edges
- Delete button might wrap on small screens

---

## Accessibility Features

### Visual Indicators
- Icons: Phone, Loading, Alert, Check
- Colors: Green (success), Red (error), Blue (primary)
- Text + Color combinations (not color-only)

### Interactive Elements
- All buttons have clear labels
- Disabled states visually distinct
- Modal has focus management (z-index)
- Error messages clearly associated with source

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space activates buttons
- Modal can be closed with Escape via Cancel button

---

## Summary

This UX flow ensures:

✅ **Clarity** - Users always know what state they're in (loading, empty, list, error)
✅ **Guidance** - Clear CTAs for next steps (buy number, delete, retry)
✅ **Confirmation** - Delete requires explicit confirmation with consequences
✅ **Feedback** - Success and error messages clearly displayed
✅ **Accessibility** - Visual + text indicators, keyboard navigable
✅ **Responsiveness** - Works on all screen sizes

The complete flow from page load through successful deletion (or error) is now visible and professional.
