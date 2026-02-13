const { chromium } = require('@playwright/test');

async function testContactForm() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture all requests/responses
  const requests = [];
  const responses = [];

  page.on('request', (request) => {
    requests.push({
      method: request.method(),
      url: request.url(),
      postData: request.postData(),
    });
  });

  page.on('response', (response) => {
    responses.push({
      status: response.status(),
      url: response.url(),
      statusText: response.statusText(),
    });
  });

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.toString());
  });

  try {
    console.log('\n🚀 OPENING PAGE: http://localhost:3000/start');
    await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('\n📋 ANALYZING FORM STRUCTURE:');

    // Get all form inputs
    const formContent = await page.locator('form').innerHTML();
    console.log(`Form HTML length: ${formContent.length} characters`);

    // Extract all input names and types
    const inputElements = await page.locator('input[name], textarea[name], select[name]').all();
    console.log(`\nFound ${inputElements.length} named form fields:`);

    for (const elem of inputElements) {
      const name = await elem.getAttribute('name');
      const type = await elem.getAttribute('type');
      const required = await elem.getAttribute('required');
      const placeholder = await elem.getAttribute('placeholder');
      console.log(`  - ${name} (type: ${type || 'text'}, required: ${!!required}, placeholder: "${placeholder}")`);
    }

    console.log('\n📝 FILLING FORM WITH TEST DATA:');

    // Fill each field that exists
    const testData = {
      company: 'Test Company',
      email: 'browser-test@example.com',
      phone: '+15551234567',
      website: 'https://test-clinic.com',
      greetingScript: 'Thank you for calling. How may I help you today?'
    };

    for (const [name, value] of Object.entries(testData)) {
      const field = page.locator(`input[name="${name}"], textarea[name="${name}"]`).first();
      const exists = await field.count();
      if (exists > 0) {
        try {
          await field.fill(value);
          const filled = await field.inputValue();
          console.log(`  ✅ ${name}: "${filled}"`);
        } catch (e) {
          console.log(`  ❌ ${name}: ${e.message}`);
        }
      }
    }

    console.log('\n🔘 FINDING AND CLICKING SUBMIT BUTTON:');

    const submitBtn = page.locator('button[type="submit"]').first();
    const submitExists = await submitBtn.count();

    if (submitExists > 0) {
      const btnText = await submitBtn.textContent();
      console.log(`  Found button: "${btnText}"`);

      // Wait a moment before submitting
      await page.waitForTimeout(500);

      console.log('  Clicking submit...');
      await submitBtn.click();

      console.log('⏳ Waiting for form submission response (3 seconds)...');
      await page.waitForTimeout(3000);

      console.log('\n📡 NETWORK ACTIVITY:');
      console.log(`POST requests made: ${requests.filter(r => r.method === 'POST').length}`);

      for (const req of requests.filter(r => r.method === 'POST')) {
        console.log(`  📤 POST: ${req.url}`);
        if (req.postData) {
          console.log(`     Data: ${req.postData.substring(0, 200)}${req.postData.length > 200 ? '...' : ''}`);
        }
      }

      console.log(`\nResponse codes: ${responses.map(r => r.status).join(', ')}`);
      for (const resp of responses) {
        if (resp.status >= 400) {
          console.log(`  ⚠️ ${resp.status} ${resp.statusText}: ${resp.url}`);
        }
      }
    } else {
      console.log('  ❌ Submit button not found!');
    }

    console.log('\n💬 PAGE CONSOLE OUTPUT:');
    if (consoleLogs.length > 0) {
      consoleLogs.forEach(log => console.log(`  ${log}`));
    } else {
      console.log('  (No console messages)');
    }

    console.log('\n🚨 PAGE ERRORS:');
    if (pageErrors.length > 0) {
      pageErrors.forEach(err => console.log(`  ❌ ${err}`));
    } else {
      console.log('  (No errors)');
    }

    console.log('\n🔍 CHECKING FOR RESPONSE MESSAGES:');

    // Wait a bit more and check DOM
    await page.waitForTimeout(1000);

    const bodyText = await page.textContent('body');
    if (bodyText.includes('Thank you') || bodyText.includes('success') || bodyText.includes('Thank You')) {
      console.log('  ✅ Success message detected in DOM');
    } else if (bodyText.includes('error') || bodyText.includes('Error')) {
      console.log('  ⚠️ Error message detected in DOM');
    } else {
      console.log('  ⓘ No obvious success/error message');
    }

    console.log('\n📸 TAKING SCREENSHOT:');
    await page.screenshot({ path: '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/form-screenshot.png' });
    console.log('  Saved to form-screenshot.png');

    // Get current URL to see if redirected
    const currentUrl = page.url();
    console.log(`\n🌐 Current URL: ${currentUrl}`);

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  } finally {
    await page.close();
    await browser.close();
  }
}

testContactForm().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
