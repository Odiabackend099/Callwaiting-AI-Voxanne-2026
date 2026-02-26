import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Navigate to onboarding intake form
        await page.goto("http://localhost:3000/start", wait_until="commit", timeout=10000)
        await page.wait_for_timeout(2000)

        # Fill Company Name
        frame = context.pages[-1]
        elem = frame.locator('xpath=/html/body/div[1]/main/div/form/div[1]/input').nth(0)
        await page.wait_for_timeout(1000)
        await elem.fill('Sunrise Dental')

        # Fill Email
        frame = context.pages[-1]
        elem = frame.locator('xpath=/html/body/div[1]/main/div/form/div[3]/input').nth(0)
        await page.wait_for_timeout(1000)
        await elem.fill('frontdesk@sunrisedental.example')

        # Fill Phone (E.164 format)
        frame = context.pages[-1]
        elem = frame.locator('xpath=/html/body/div[1]/main/div/form/div[4]/input').nth(0)
        await page.wait_for_timeout(1000)
        await elem.fill('+442079460123')

        # Fill Greeting Script
        frame = context.pages[-1]
        elem = frame.locator('xpath=/html/body/div[1]/main/div/form/div[5]/textarea').nth(0)
        await page.wait_for_timeout(1000)
        await elem.fill('Hello, you have reached Sunrise Dental. How may we assist you?')

        # Select "Female Voice" from the Preferred Voice Type dropdown
        frame = context.pages[-1]
        voice_select = frame.locator('select[name="voice_preference"]').first
        await page.wait_for_timeout(1000)
        await voice_select.select_option('Female Voice')

        # Click Submit Application
        frame = context.pages[-1]
        submit_btn = frame.locator('button[type="submit"]').first
        await page.wait_for_timeout(1000)
        await submit_btn.click(timeout=10000)

        # Wait for success confirmation
        await page.wait_for_timeout(8000)

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Submitted Successfully').first).to_be_visible(timeout=10000)
        await asyncio.sleep(3)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
