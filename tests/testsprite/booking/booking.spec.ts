/**
 * TestSprite Test Suite: Appointment Booking & Calendar Integration
 *
 * Tests:
 * - Google Calendar OAuth flow
 * - End-to-end booking lifecycle (contact lookup → availability → booking)
 * - Advisory lock race condition prevention
 * - Double booking prevention
 * - Calendar sync verification
 *
 * Test Account: test@demo.com / demo123
 */

import { describe, it, beforeEach, afterEach } from '@testsprite/core';
import { expect } from '@testsprite/assertions';
import { TestContext, BrowserContext } from '@testsprite/types';

describe('Appointment Booking', () => {
  let context: TestContext;
  let browser: BrowserContext;
  let testOrgId: string;

  beforeEach(async () => {
    context = await TestSprite.createContext();
    browser = await context.newBrowser();
    testOrgId = await context.getTestOrgId();

    // Clear test data
    await context.database.execute({
      sql: 'DELETE FROM appointments WHERE org_id = $1',
      params: [testOrgId]
    });
  });

  afterEach(async () => {
    await browser.close();
    await context.cleanup();
  });

  describe('Google Calendar Integration', () => {
    it('should connect Google Calendar via OAuth', async () => {
      const page = await browser.newPage();

      // Login
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to inbound config
      await page.goto('/dashboard/inbound-config');

      // Click Connect Google Calendar
      await page.click('button[data-testid="connect-calendar"]');

      // Handle OAuth popup (TestSprite auto-handles Google OAuth)
      await context.handleOAuth({
        provider: 'google',
        allow: true,
        scope: 'calendar.readonly calendar.events'
      });

      // Wait for redirect back
      await page.waitForNavigation({ timeout: 15000 });

      // Verify success message
      await expect(page).toHaveText('.calendar-status', /connected/i);

      // Verify integration saved in database
      const result = await context.database.query({
        sql: `SELECT provider_type, encrypted_config
              FROM integrations
              WHERE org_id = $1 AND provider_type = 'google_calendar'`,
        params: [testOrgId]
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].encrypted_config).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: './test-results/screenshots/calendar-connected.png'
      });
    });

    it('should handle OAuth cancellation gracefully', async () => {
      const page = await browser.newPage();

      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      await page.goto('/dashboard/inbound-config');
      await page.click('button[data-testid="connect-calendar"]');

      // Cancel OAuth
      await context.handleOAuth({
        provider: 'google',
        allow: false
      });

      // Should show error message
      await expect(page).toHaveText('.error-message', /cancelled|declined/i);

      // Verify NOT saved in database
      const result = await context.database.query({
        sql: `SELECT COUNT(*) as count
              FROM integrations
              WHERE org_id = $1 AND provider_type = 'google_calendar'`,
        params: [testOrgId]
      });

      expect(result.rows[0].count).toBe(0);
    });
  });

  describe('End-to-End Booking Flow', () => {
    beforeEach(async () => {
      // Ensure calendar is connected
      await context.connectGoogleCalendar(testOrgId);
    });

    it('should complete full booking lifecycle via Vapi tools', async () => {
      const testPhone = '+15551234567';
      const testDate = '2026-02-25';
      const testTime = '10:00:00Z';

      // Step 1: Lookup Contact (simulates Vapi tool call)
      const lookupResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/lookup-contact',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          phone: testPhone,
          name: 'Test Patient'
        }
      });

      expect(lookupResponse.status).toBe(200);
      expect(lookupResponse.body.success).toBe(true);
      expect(lookupResponse.body.contact.phone).toBe(testPhone);

      const contactId = lookupResponse.body.contact.id;

      // Step 2: Check Availability
      const availabilityResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/check-availability',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          requestedDate: testDate
        }
      });

      expect(availabilityResponse.status).toBe(200);
      expect(availabilityResponse.body.success).toBe(true);
      expect(availabilityResponse.body.availableSlots.length).toBeGreaterThan(0);

      // Verify the test time is available
      const isAvailable = availabilityResponse.body.availableSlots.includes('10:00');
      expect(isAvailable).toBe(true);

      // Step 3: Book Appointment
      const bookingResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          contactId: contactId,
          scheduledAt: `${testDate}T${testTime}`,
          durationMinutes: 45,
          title: 'TestSprite Booking Test'
        }
      });

      expect(bookingResponse.status).toBe(200);
      expect(bookingResponse.body.success).toBe(true);
      expect(bookingResponse.body.appointmentId).toBeTruthy();

      const appointmentId = bookingResponse.body.appointmentId;

      // Step 4: Verify in Dashboard
      const page = await browser.newPage();
      await page.goto('https://voxanne.ai/sign-in');
      await page.fill('input[name="email"]', 'test@demo.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      await page.goto('/dashboard/appointments');
      await page.waitForSelector('.appointments-table', { timeout: 5000 });

      // Find appointment card
      const appointmentCard = await page.waitForSelector(
        `[data-appointment-id="${appointmentId}"]`,
        { timeout: 5000 }
      );

      expect(appointmentCard).toBeTruthy();

      // Verify appointment details
      const cardText = await appointmentCard.textContent();
      expect(cardText).toContain('Test Patient');
      expect(cardText).toContain('Feb 25, 2026');

      // Take screenshot
      await page.screenshot({
        path: './test-results/screenshots/booking-success.png',
        fullPage: true
      });

      // Step 5: Verify in database
      const dbResult = await context.database.query({
        sql: `SELECT * FROM appointments WHERE id = $1 AND org_id = $2`,
        params: [appointmentId, testOrgId]
      });

      expect(dbResult.rows).toHaveLength(1);

      const appointment = dbResult.rows[0];
      expect(appointment.contact_id).toBe(contactId);
      expect(appointment.duration_minutes).toBe(45);
      expect(appointment.status).toBe('scheduled');
    });

    it('should handle booking conflicts gracefully', async () => {
      const testPhone = '+15559876543';
      const testDate = '2026-02-26';
      const testTime = '14:00:00Z';

      // Create contact
      const contact = await context.database.insert({
        table: 'contacts',
        data: {
          org_id: testOrgId,
          phone: testPhone,
          first_name: 'Conflict',
          last_name: 'Test'
        }
      });

      // Book first appointment
      const firstBooking = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          contactId: contact.id,
          scheduledAt: `${testDate}T${testTime}`,
          durationMinutes: 30,
          title: 'First Appointment'
        }
      });

      expect(firstBooking.status).toBe(200);
      expect(firstBooking.body.success).toBe(true);

      // Attempt second booking at overlapping time (14:15 overlaps with 14:00-14:30)
      const secondBooking = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          contactId: contact.id,
          scheduledAt: `${testDate}T14:15:00Z`,
          durationMinutes: 30,
          title: 'Conflicting Appointment'
        }
      });

      // Should return 409 Conflict
      expect(secondBooking.status).toBe(409);
      expect(secondBooking.body.error).toMatch(/conflict|overlapping|unavailable/i);

      // Verify conflicting appointment details returned
      expect(secondBooking.body.conflictingAppointment).toBeTruthy();
      expect(secondBooking.body.conflictingAppointment.id).toBe(firstBooking.body.appointmentId);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent double bookings via advisory locks', async () => {
      const testDate = '2026-02-27';
      const testTime = '09:00:00Z';

      // Create contact
      const contact = await context.database.insert({
        table: 'contacts',
        data: {
          org_id: testOrgId,
          phone: '+15557654321',
          first_name: 'Race',
          last_name: 'Test'
        }
      });

      // Simulate 1000 concurrent booking attempts
      const bookingPromises = Array.from({ length: 1000 }, () =>
        context.apiCall({
          method: 'POST',
          url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
          headers: {
            'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
          },
          body: {
            orgId: testOrgId,
            contactId: contact.id,
            scheduledAt: `${testDate}T${testTime}`,
            durationMinutes: 30,
            title: 'Race Condition Test'
          },
          timeout: 30000
        })
      );

      // Execute all requests concurrently
      const results = await Promise.allSettled(bookingPromises);

      // Count successes and failures
      const successes = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );

      const conflicts = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 409
      );

      // Exactly 1 should succeed, 999 should fail with conflict
      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(999);

      // Verify only 1 appointment created in database
      const dbResult = await context.database.query({
        sql: `SELECT COUNT(*) as count
              FROM appointments
              WHERE org_id = $1 AND scheduled_at = $2`,
        params: [testOrgId, `${testDate} ${testTime.replace('Z', '')}`]
      });

      expect(dbResult.rows[0].count).toBe(1);
    });

    it('should handle concurrent bookings for different time slots', async () => {
      const testDate = '2026-02-28';

      const contact = await context.database.insert({
        table: 'contacts',
        data: {
          org_id: testOrgId,
          phone: '+15556543210',
          first_name: 'Concurrent',
          last_name: 'Test'
        }
      });

      // Create bookings for different time slots concurrently
      const bookingPromises = [
        '09:00:00Z',
        '10:00:00Z',
        '11:00:00Z',
        '14:00:00Z',
        '15:00:00Z'
      ].map(time =>
        context.apiCall({
          method: 'POST',
          url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
          headers: {
            'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
          },
          body: {
            orgId: testOrgId,
            contactId: contact.id,
            scheduledAt: `${testDate}T${time}`,
            durationMinutes: 30,
            title: `Appointment at ${time}`
          }
        })
      );

      const results = await Promise.all(bookingPromises);

      // All should succeed (no conflicts)
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify 5 appointments created
      const dbResult = await context.database.query({
        sql: `SELECT COUNT(*) as count
              FROM appointments
              WHERE org_id = $1 AND scheduled_at::date = $2`,
        params: [testOrgId, testDate]
      });

      expect(dbResult.rows[0].count).toBe(5);
    });
  });

  describe('Calendar Sync Verification', () => {
    beforeEach(async () => {
      await context.connectGoogleCalendar(testOrgId);
    });

    it('should create Google Calendar event when booking', async () => {
      const testPhone = '+15554321098';
      const testDate = '2026-03-01';
      const testTime = '10:00:00Z';

      // Create contact
      const contact = await context.database.insert({
        table: 'contacts',
        data: {
          org_id: testOrgId,
          phone: testPhone,
          first_name: 'Calendar',
          last_name: 'Sync',
          email: 'calendar@test.com'
        }
      });

      // Book appointment
      const bookingResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          contactId: contact.id,
          scheduledAt: `${testDate}T${testTime}`,
          durationMinutes: 45,
          title: 'Calendar Sync Test'
        }
      });

      expect(bookingResponse.status).toBe(200);

      // Wait for calendar sync (webhook processing)
      await context.waitFor(3000);

      // Verify event created in Google Calendar
      const calendarEvents = await context.getGoogleCalendarEvents({
        orgId: testOrgId,
        startDate: testDate,
        endDate: testDate
      });

      const matchingEvent = calendarEvents.find((event: any) =>
        event.summary === 'Calendar Sync Test' &&
        event.start.dateTime.includes(testDate)
      );

      expect(matchingEvent).toBeTruthy();
      expect(matchingEvent.attendees).toContainEqual({
        email: 'calendar@test.com'
      });
    });

    it('should update Google Calendar event when rescheduling', async () => {
      // Create and book appointment
      const contact = await context.database.insert({
        table: 'contacts',
        data: {
          org_id: testOrgId,
          phone: '+15553210987',
          first_name: 'Reschedule',
          last_name: 'Test'
        }
      });

      const originalDate = '2026-03-02';
      const newDate = '2026-03-03';

      const bookingResponse = await context.apiCall({
        method: 'POST',
        url: 'https://voxanneai.onrender.com/api/vapi-tools/book-appointment',
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          orgId: testOrgId,
          contactId: contact.id,
          scheduledAt: `${originalDate}T14:00:00Z`,
          durationMinutes: 30,
          title: 'Reschedule Test'
        }
      });

      const appointmentId = bookingResponse.body.appointmentId;

      // Reschedule
      const rescheduleResponse = await context.apiCall({
        method: 'PATCH',
        url: `https://voxanneai.onrender.com/api/appointments/${appointmentId}`,
        headers: {
          'x-vapi-secret': process.env.VAPI_PRIVATE_KEY!
        },
        body: {
          scheduledAt: `${newDate}T15:00:00Z`
        }
      });

      expect(rescheduleResponse.status).toBe(200);

      await context.waitFor(3000);

      // Verify no event on original date
      const originalEvents = await context.getGoogleCalendarEvents({
        orgId: testOrgId,
        startDate: originalDate,
        endDate: originalDate
      });

      const hasOriginalEvent = originalEvents.some((event: any) =>
        event.summary === 'Reschedule Test'
      );

      expect(hasOriginalEvent).toBe(false);

      // Verify event on new date
      const newEvents = await context.getGoogleCalendarEvents({
        orgId: testOrgId,
        startDate: newDate,
        endDate: newDate
      });

      const hasNewEvent = newEvents.some((event: any) =>
        event.summary === 'Reschedule Test'
      );

      expect(hasNewEvent).toBe(true);
    });
  });
});
