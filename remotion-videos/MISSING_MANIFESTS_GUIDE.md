# Missing Manifests Generation Guide
**Phase 2 Prerequisites - 8 Manifests Required**

---

## Overview

To complete Phase 2 (rendering verification), we need 8 additional manifest files containing DOM element coordinates for dashboard pages.

**Current Status:** 4 of 12 manifests exist (33%)
**Required for Phase 2:** 12 of 12 manifests (100%)

---

## Manifest Generation Workflow

### Prerequisites
- Login credentials: `voxanne@demo.com` / `demo123`
- Playwright installed in `playwright-screenshots/` directory
- Voxanne dashboard running (local or production)

### Standard Manifest Structure
```json
{
  "screenshotName": "XX_page_name.png",
  "resolution": { "width": 1920, "height": 1080 },
  "capturedAt": "2026-02-04T19:00:00.000Z",
  "elements": [
    {
      "name": "element-name",
      "selector": "CSS selector used",
      "x": 100,
      "y": 200,
      "width": 400,
      "height": 50,
      "centerX": 300,
      "centerY": 225
    }
  ]
}
```

---

## Missing Manifest #1: Google Auth Modal

**Filename:** `01_google_auth_modal.json`
**Screenshot:** `01_google_auth_modal.png`
**Used by:** Scene3_GoogleAuth.tsx

### Navigation Path
1. Go to `https://voxanne.ai/login` (or `http://localhost:3000/login`)
2. Look for "Sign in with Google" button
3. Click button (don't complete OAuth - just capture the modal)

### Elements to Extract (3 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `google-sign-in-button` | `button:has-text("Sign in with Google")` | Main OAuth button |
| `permissions-list` | `.permissions-list` or `ul` | List of requested permissions |
| `allow-button` | `button:has-text("Allow")` or `button[type="submit"]` | OAuth consent button |

### Expected Coordinates (approximate)
- Modal should be centered: ~800-1100px X, ~400-600px Y
- Button width: ~300-400px

---

## Missing Manifest #2: Agent Configuration Page

**Filename:** `02_agent_config_page.json`
**Screenshot:** `02_agent_config_page.png`
**Used by:** Scene3_ConfigureAgent.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard/agent-configuration` (or click "Agent Configuration" in sidebar)

### Elements to Extract (4 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `agent-name-input` | `input[name="agentName"]` or `input[placeholder*="Agent Name"]` | Agent name field |
| `system-prompt-textarea` | `textarea[name="systemPrompt"]` or `textarea[placeholder*="prompt"]` | System prompt field |
| `save-button` | `button:has-text("Save")` or `button[type="submit"]` | Save configuration button |
| `test-call-button` | `button:has-text("Test Call")` or `button:has-text("Test")` | Test call button |

### Expected Coordinates (approximate)
- Form fields: Left-aligned, ~200-800px X
- Buttons: Bottom-right, ~1400-1600px X, ~900-1000px Y

---

## Missing Manifest #3: Knowledge Upload Page

**Filename:** `03_knowledge_upload.json`
**Screenshot:** `03_knowledge_upload.png`
**Used by:** Scene4_UploadKnowledge.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard/knowledge-base` (or click "Knowledge Base" in sidebar)

### Elements to Extract (4 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `upload-zone` | `.upload-zone` or `div[role="button"]` | Drag-and-drop upload area |
| `file-list` | `.file-list` or `ul` | List of uploaded files |
| `process-button` | `button:has-text("Process")` or `button:has-text("Upload")` | Process files button |
| `progress-bar` | `.progress-bar` or `div[role="progressbar"]` | Upload progress indicator |

### Expected Coordinates (approximate)
- Upload zone: Centered, ~400-1500px X, ~300-600px Y
- File list: Below upload zone
- Progress bar: Full width, ~100-1800px X

---

## Missing Manifest #4: Telephony Configuration Page

**Filename:** `04_telephony_config.json`
**Screenshot:** `04_telephony_config.png`
**Used by:** Scene5_ConnectTelephony.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard/inbound-config` (or click "Telephony" in sidebar)

### Elements to Extract (4 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `twilio-sid-input` | `input[name="twilioAccountSid"]` or `input[placeholder*="SID"]` | Twilio Account SID field |
| `twilio-token-input` | `input[name="twilioAuthToken"]` or `input[placeholder*="Token"]` | Twilio Auth Token field |
| `phone-number-select` | `select[name="phoneNumber"]` or `select` | Phone number dropdown |
| `save-config-button` | `button:has-text("Save")` or `button[type="submit"]` | Save config button |

### Expected Coordinates (approximate)
- Input fields: Left-aligned, ~200-800px X
- Dropdown: Below inputs
- Save button: Bottom-right

---

## Missing Manifest #5: AI Forwarding Setup Page

**Filename:** `05_ai_forwarding_setup.json`
**Screenshot:** `05_ai_forwarding_setup.png`
**Used by:** Scene6_AIForwarding.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard/telephony` (or click "AI Forwarding" in sidebar)

### Elements to Extract (4 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `forwarding-toggle` | `input[type="checkbox"]` or `button[role="switch"]` | Enable/disable toggle |
| `destination-number-input` | `input[name="destinationNumber"]` or `input[placeholder*="Phone"]` | Destination phone field |
| `verification-code-input` | `input[name="verificationCode"]` or `input[placeholder*="Code"]` | 6-digit code field |
| `activate-button` | `button:has-text("Activate")` or `button:has-text("Save")` | Activate forwarding button |

### Expected Coordinates (approximate)
- Toggle: Top-right, ~1600-1700px X
- Input fields: Left-aligned, ~200-800px X
- Activate button: Bottom-right

---

## Missing Manifest #6: Phone Test Page

**Filename:** `06_phone_test_page.json`
**Screenshot:** `06_phone_test_page.png`
**Used by:** Scene8_LivePhoneTest.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard/test-agent` (or click "Test Agent" in sidebar)

### Elements to Extract (3 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `test-phone-number-display` | `.phone-number` or `span[data-testid="phone"]` | Displayed test phone number |
| `call-now-button` | `button:has-text("Call Now")` or `button:has-text("Test")` | Initiate test call button |
| `call-status-indicator` | `.status-indicator` or `div[data-status]` | Call status (idle/ringing/connected) |

### Expected Coordinates (approximate)
- Phone number: Centered, ~800-1100px X
- Call button: Below phone number
- Status indicator: Near phone number

---

## Missing Manifest #7: Call Logs Page

**Filename:** `07_call_logs_page.json`
**Screenshot:** `07_call_logs_page.png`
**Used by:** Scene9_CallLogs.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard/call-logs` (or click "Call Logs" in sidebar)

### Elements to Extract (4 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `call-logs-table` | `table` or `.call-logs-table` | Main data table |
| `date-filter` | `input[type="date"]` or `.date-picker` | Date range filter |
| `status-filter` | `select[name="status"]` or `.status-filter` | Call status dropdown |
| `first-call-row` | `tbody tr:first-child` | First row in table (for highlighting) |

### Expected Coordinates (approximate)
- Table: Full width, ~100-1800px X
- Filters: Top of table, ~100-500px X
- First row: Below filters

---

## Missing Manifest #8: Hot Leads Page

**Filename:** `08_hot_leads_page.json`
**Screenshot:** `08_hot_leads_page.png`
**Used by:** Scene10_HotLeads.tsx

### Navigation Path
1. Login: `voxanne@demo.com` / `demo123`
2. Go to `/dashboard` (main dashboard)
3. Scroll to "Hot Leads" section or click "Hot Leads" in sidebar

### Elements to Extract (4 minimum)

| Element Name | CSS Selector | Description |
|-------------|--------------|-------------|
| `hot-leads-list` | `.hot-leads-list` or `div[data-widget="hot-leads"]` | Container for leads list |
| `lead-score-badge` | `.score-badge` or `span[data-score]` | First lead's score badge (0-100) |
| `callback-button` | `button:has-text("Call Back")` or `button[data-action="callback"]` | Call back button |
| `first-lead-row` | `.lead-item:first-child` or `div[data-lead]:first-child` | First lead in list |

### Expected Coordinates (approximate)
- Leads list: Right side of dashboard, ~1000-1800px X
- Score badge: Inside lead row
- Callback button: Right side of lead row

---

## Playwright Capture Script Template

```typescript
// playwright-screenshots/capture-manifest.ts
import { chromium } from '@playwright/test';
import * as fs from 'fs';

async function captureManifest(
  pageName: string,
  url: string,
  elements: { name: string; selector: string }[]
) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'voxanne@demo.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/dashboard**');

  // Navigate to target page
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  // Capture screenshot
  await page.screenshot({ path: `public/screenshots/${pageName}.png` });

  // Extract coordinates
  const manifest = {
    screenshotName: `${pageName}.png`,
    resolution: { width: 1920, height: 1080 },
    capturedAt: new Date().toISOString(),
    elements: await Promise.all(
      elements.map(async ({ name, selector }) => {
        const element = await page.locator(selector).first();
        const box = await element.boundingBox();
        if (!box) throw new Error(`Element not found: ${selector}`);

        return {
          name,
          selector,
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          centerX: Math.round(box.x + box.width / 2),
          centerY: Math.round(box.y + box.height / 2),
        };
      })
    ),
  };

  // Save manifest
  fs.writeFileSync(
    `public/manifests/${pageName}.json`,
    JSON.stringify(manifest, null, 2)
  );

  console.log(`✅ Generated: ${pageName}.json (${manifest.elements.length} elements)`);
  await browser.close();
}

// Example usage
captureManifest(
  '01_google_auth_modal',
  'http://localhost:3000/login', // Then click Google button
  [
    { name: 'google-sign-in-button', selector: 'button:has-text("Sign in with Google")' },
    { name: 'permissions-list', selector: '.permissions-list' },
    { name: 'allow-button', selector: 'button:has-text("Allow")' },
  ]
);
```

---

## Validation Checklist

After generating each manifest, verify:

- [ ] Screenshot file exists in `public/screenshots/`
- [ ] Manifest JSON file exists in `public/manifests/`
- [ ] All required elements are present
- [ ] Coordinates are within viewport (0-1920 X, 0-1080 Y)
- [ ] CenterX/Y calculations are correct (x + width/2, y + height/2)
- [ ] JSON is properly formatted (2-space indentation)

---

## Quick Test Command

```bash
# Test manifest loading in Node.js
cd remotion-videos
node -e "
const manifest = require('./public/manifests/01_google_auth_modal.json');
console.log('Loaded:', manifest.screenshotName);
console.log('Elements:', manifest.elements.length);
manifest.elements.forEach(el => {
  console.log(\`  - \${el.name}: (\${el.centerX}, \${el.centerY})\`);
});
"
```

---

## Priority Order

Generate manifests in this order to unblock scenes progressively:

1. **01_google_auth_modal.json** (Scene3_GoogleAuth - simplest)
2. **02_agent_config_page.json** (Scene3_ConfigureAgent - critical flow)
3. **03_knowledge_upload.json** (Scene4_UploadKnowledge - important demo feature)
4. **06_phone_test_page.json** (Scene8_LivePhoneTest - visual demo)
5. **07_call_logs_page.json** (Scene9_CallLogs - dashboard showcase)
6. **08_hot_leads_page.json** (Scene10_HotLeads - dashboard showcase)
7. **04_telephony_config.json** (Scene5_ConnectTelephony - optional)
8. **05_ai_forwarding_setup.json** (Scene6_AIForwarding - optional)

---

## Estimated Time

- Setup Playwright script: 30 minutes (one-time)
- Capture each page: 15-20 minutes
- Total for 8 manifests: **2-3 hours**

---

**Next Step:** Generate manifests using Playwright, then proceed to Phase 2 scene refactoring.
