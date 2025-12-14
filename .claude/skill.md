
---

name: voxanne-sales-implementer
description: Guide the implementation of the Voxanne Sales System, focusing on Agent Settings, Call Logs, Mobile App, Analytics, and ROI Calculator. Use when working on Voxanne features or when the user mentions priorities like "Agent Settings", "Call Logs", "Mobile App", or "Analytics"
---

# Voxanne Sales Implementer

This skill guides the implementation of the detailed Voxanne Sales System and Dashboard features.

## Priorities

### 1. Agent Settings Page

- **Goal**: Configure Voxanne's personality using existing config and voice chat UI.
- **Components**:
  - Personality Selector (Professional/Friendly/Casual).
  - Voice ID Selector (using Vapi/Deepgram voices).
  - System Prompt Editor.
  - "Test Voice" interactive widget.

### 2. Call Logs Detail View

- **Goal**: Full transcript + recording player view.
- **Features**:
  - Waveform audio player.
  - Analyzed transcript with sentiment highlighting.
  - Action items extraction.
  - Export to PDF/CSV.

### 3. Mobile App Version

- **Goal**: iOS/Android optimized mobile view.
- **Strategy**:
  - Responsive design first (PWA).
  - Touch-optimized navigation (Bottom Tab Bar).
  - Mobile-specific interactions (Swipe to archive).

### 4. Analytics Deep-Dive

- **Goal**: Advanced insights and reports.
- **Metrics**:
  - Call volume trends (Heatmaps).
  - Conversion funnels.
  - Sentiment analysis over time.
  - Peak hours identification.

### 5. ROI Calculator Widget

- **Goal**: Show exact savings vs. human receptionist.
- **Inputs**:
  - Monthly receptionist salary.
  - Call volume.
  - Missed call rate.
- **Outputs**:
  - Annual savings.
  - Revenue recovered from missed calls.

## Instructions

1. **Check Implementation Plan**: detailed steps in `implementation_plan.md` (create if missing).
2. **Follow Design System**: Use the existing "Premium Glassmorphism" aesthetic (Slate-950/900 background, Emerald/Cyan/Purple accents).
3. **Verify Compliance**: Ensure all features maintain "Safe Mode" and medical disclaimers where appropriate.
4. **Interactive Development**: When building UI, assume React + Tailwind + Lucide Icons.

## Example User Queries

- "Let's build the Agent Settings page"
- "Show me the Call Logs design"
- "How do we calculate ROI?"
