---
description: Debug and fix a blank screen or crash in the Next.js frontend
---

# Frontend Crash Debugging Protocol

Use this workflow when the Next.js app shows a blank screen, a 500 error, or fails to start.

## 1. Clean Slate (The "Turn it off and on again")

// turbo

1. Stop any running dev servers.
2. Remove the Next.js cache directory:

   ```bash
   rm -rf .next
   ```

3. Remove node_modules cache (optional but recommended for weird dependency issues):

   ```bash
   rm -rf .next
   ```

4. Restart the development server:

   ```bash
   npm run dev
   ```

## 2. Browser Console Inspection

If the screen is still blank:

1. Open Chrome/Browser Developer Tools (F12 or Cmd+Option+I).
2. Go to the **Console** tab.
3. Look for Red Errors. Common culprits:
   - `Hydration failed`: strict mode mismatch.
   - `Minified React error`: usually a Suspense boundary issue or invalid object passed to child.
   - `404 Not Found`: Missing resource.

## 3. Server Log Inspection

Check the terminal where `npm run dev` is running.

- Look for "Module not found".
- Look for syntax errors.

## 4. Verify Critical Files

Ensure critical entry points exist:

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/middleware.ts` (if used)

## 5. Dependency Check

If you recently installed/uninstalled packages:

1. Run `npm install` to ensure lockfile is in sync.
