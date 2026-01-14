import { test, expect } from '@playwright/test';

test.describe('Clinical Auditor UI', () => {
    test('displays correct sentiment traffic lights and urgency badges', async ({ page }) => {
        // Enable console logging from browser
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));
        page.on('requestfailed', req => console.log(`REQUEST FAILED: ${req.url()} ${req.failure()?.errorText}`));

        // Mock API
        await page.route('**/api/calls-dashboard*', async route => {
            console.log('Intercepted calls-dashboard request:', route.request().url());
            const json = {
                calls: [
                    {
                        id: 'case-a-facelift',
                        phone_number: '+447700900000',
                        caller_name: 'Case A Facelift',
                        call_date: new Date().toISOString(),
                        duration_seconds: 120,
                        status: 'completed',
                        sentiment_label: 'Decisive',
                        sentiment_score: 0.85,
                        sentiment_urgency: 'Medium',
                        sentiment_summary: 'Patient wants facelift. Price overlap OK.',
                        has_recording: true,
                        recording_status: 'completed',
                        recording_url: 'https://example.com/fake.mp3',
                        call_type: 'inbound'
                    },
                    {
                        id: 'case-b-friction',
                        phone_number: '+447700900001',
                        caller_name: 'Case B Friction',
                        call_date: new Date().toISOString(),
                        duration_seconds: 450,
                        status: 'completed',
                        sentiment_label: 'Frustrated',
                        sentiment_score: 0.25,
                        sentiment_urgency: 'High',
                        sentiment_summary: 'Angry regarding hold times.',
                        has_recording: true,
                        recording_status: 'completed',
                        call_type: 'inbound'
                    },
                    {
                        id: 'case-c-routine',
                        phone_number: '+447700900002',
                        caller_name: 'Case C Routine',
                        call_date: new Date().toISOString(),
                        duration_seconds: 30,
                        status: 'completed',
                        sentiment_label: 'Neutral',
                        sentiment_score: 0.5,
                        sentiment_urgency: 'Low',
                        sentiment_summary: 'Asking for opening hours.',
                        has_recording: true,
                        recording_status: 'completed',
                        call_type: 'inbound'
                    }
                ],
                pagination: { total: 3, page: 1, limit: 100 }
            };
            await route.fulfill({ json });
        });

        await page.route('**/api/calls-dashboard/analytics/summary*', async route => {
            console.log('Intercepted analytics summary:', route.request().url());
            await route.fulfill({ json: { total_calls: 3, completed_calls: 3, average_duration: 200, average_sentiment: 0.5 } });
        });

        // Navigate to dashboard
        // Note: Assuming we can bypass login or are mocking auth state. 
        // If Auth is complex, we might need setup. 
        // For now, we assume the page can render or redirects to login. 
        // If login needed, we might need to mock cookie or use a fixture.
        // The current page.tsx has a useEffect to redirect if !user, but we can verify if it renders.

        // In strict E2E we'd log in. But for this specific UI check, 
        // we can try to inject a mock User context/cookie if possible?
        // Or just rely on the fact that we are mocking the *Data* and assume the *Page* loads.

        await page.goto('http://localhost:3000/dashboard/calls');

        // Wait for table to load
        await expect(page.getByText('Call Recordings')).toBeVisible();

        // Verify Case B (High Urgency + Frustrated)
        const rowB = page.getByRole('row').filter({ hasText: 'Case B Friction' });
        await expect(rowB).toBeVisible();
        await expect(rowB).toContainText('Frustrated');
        await expect(rowB).toContainText('High Urgency'); // Badge Check

        // Verify Case A (Medium + Decisive)
        const rowA = page.getByRole('row').filter({ hasText: 'Case A Facelift' });
        await expect(rowA).toContainText('Decisive');
        await expect(rowA).toContainText('Medium');

        // Verify Case C (Low + Neutral)
        const rowC = page.getByRole('row').filter({ hasText: 'Case C Routine' });
        await expect(rowC).toContainText('Neutral');
        // Low urgency might not have a badge (check page.tsx logic: "default: return null;")
        // So we assert it does NOT contain "High" or "Medium".
        await expect(rowC).not.toContainText('High Urgency');
        await expect(rowC).not.toContainText('Medium');

        // Verify Modal for Case A
        console.log('Clicking Case A row (Cell force)...');
        // Click the cell containing the caller name
        await rowA.getByRole('cell').filter({ hasText: 'Case A Facelift' }).click({ force: true });

        console.log('Waiting for Modal Container...');
        const modal = page.locator('.fixed.inset-0').first();
        await expect(modal).toBeVisible();

        console.log('Waiting for Clinical Summary text...');
        await expect(page.locator('text=Clinical Summary')).toBeVisible();
        await expect(page.getByText('Patient wants facelift')).toBeVisible();

        // Close modal
        console.log('Closing modal...');
        await page.locator('button').filter({ hasText: 'Close' }).or(page.locator('.lucide-x').first()).click({ force: true });
    });
});
