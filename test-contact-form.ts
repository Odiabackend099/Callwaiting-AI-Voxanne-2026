import { chromium, Page, Browser } from '@playwright/test';

async function testContactForm() {
  const browser: Browser = await chromium.launch({ headless: false });
  const page: Page = await browser.newPage();

  // Set up console log listener
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Set up network listener
  const networkErrors: string[] = [];
  page.on('response', (response) => {
    if (!response.ok()) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('🚀 Opening contact form page...');
    await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle' });

    console.log('⏳ Waiting for form to load...');
    await page.waitForTimeout(2000);

    console.log('\n📋 FORM STATE:');

    // Check if form exists
    const formExists = await page.locator('form').count();
    console.log(`Form elements found: ${formExists}`);

    // Try to find all input fields
    const inputs = await page.locator('input, textarea, select').all();
    console.log(`Total input fields found: ${inputs.length}`);

    // List all visible fields
    console.log('\n🔍 Visible fields:');
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const field = inputs[i];
      const type = await field.getAttribute('type');
      const name = await field.getAttribute('name');
      const id = await field.getAttribute('id');
      const placeholder = await field.getAttribute('placeholder');
      const visible = await field.isVisible();
      console.log(`  [${i}] Type: ${type || 'text'}, Name: ${name}, ID: ${id}, Placeholder: ${placeholder}, Visible: ${visible}`);
    }

    console.log('\n📝 Attempting to fill form...');

    // Try different selectors for each field
    const fieldMappings = [
      { label: 'Name', selectors: ['input[name="name"]', 'input[placeholder*="Name"]', 'input[id*="name"]'] },
      { label: 'Email', selectors: ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="Email"]'] },
      { label: 'Phone', selectors: ['input[name="phone"]', 'input[type="tel"]', 'input[placeholder*="Phone"]'] },
      { label: 'Company', selectors: ['input[name="company"]', 'input[placeholder*="Company"]'] },
      { label: 'Subject', selectors: ['input[name="subject"]', 'input[placeholder*="Subject"]'] },
      { label: 'Message', selectors: ['textarea[name="message"]', 'textarea[placeholder*="Message"]'] }
    ];

    for (const field of fieldMappings) {
      let filled = false;
      for (const selector of field.selectors) {
        const element = page.locator(selector).first();
        const exists = await element.count();
        if (exists > 0) {
          console.log(`  ✅ Found ${field.label} field with selector: ${selector}`);
          try {
            await element.scrollIntoViewIfNeeded();
            await element.focus();
            await element.fill(''); // Clear first
            await page.waitForTimeout(100);

            // Fill with appropriate data
            let value = '';
            switch (field.label.toLowerCase()) {
              case 'name':
                value = 'Browser Test User';
                break;
              case 'email':
                value = 'browser-test@example.com';
                break;
              case 'phone':
                value = '+15551234567';
                break;
              case 'company':
                value = 'Test Company';
                break;
              case 'subject':
                value = 'Browser Submit Test';
                break;
              case 'message':
                value = 'Testing form submission from browser MCP';
                break;
            }

            await element.type(value, { delay: 50 });
            const filledValue = await element.inputValue();
            console.log(`    Filled with: "${filledValue}"`);
            filled = true;
            break;
          } catch (e) {
            console.log(`    ❌ Failed to fill: ${e}`);
          }
        }
      }
      if (!filled) {
        console.log(`  ❌ Could not find ${field.label} field`);
      }
    }

    console.log('\n🔘 Looking for submit button...');

    // Try to find submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Send")',
      'button:has-text("Contact")',
      'input[type="submit"]'
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      const button = page.locator(selector).first();
      const exists = await button.count();
      if (exists > 0) {
        console.log(`  ✅ Found submit button: ${selector}`);
        submitButton = button;
        break;
      }
    }

    if (submitButton) {
      console.log('\n🚀 Clicking submit button...');
      await submitButton.scrollIntoViewIfNeeded();
      await submitButton.click();

      console.log('⏳ Waiting for response (3 seconds)...');
      await page.waitForTimeout(3000);

      console.log('\n✨ RESPONSE ANALYSIS:');

      // Check for success message
      const successSelectors = [
        'text=success',
        'text=Thank you',
        'text=sent',
        'text=received',
        '[class*="success"]',
        '[class*="success-message"]'
      ];

      let successFound = false;
      for (const selector of successSelectors) {
        const element = page.locator(selector).first();
        const exists = await element.count();
        if (exists > 0) {
          const text = await element.textContent();
          console.log(`  ✅ SUCCESS MESSAGE FOUND: "${text}"`);
          successFound = true;
          break;
        }
      }

      if (!successFound) {
        console.log('  ❌ No success message detected');
      }

      // Check for error message
      const errorSelectors = [
        'text=error',
        'text=failed',
        'text=Error',
        '[class*="error"]',
        '[class*="error-message"]',
        '[role="alert"]'
      ];

      for (const selector of errorSelectors) {
        const element = page.locator(selector).first();
        const exists = await element.count();
        if (exists > 0) {
          const text = await element.textContent();
          console.log(`  ⚠️ ERROR MESSAGE: "${text}"`);
        }
      }
    } else {
      console.log('  ❌ Could not find submit button');
    }

    console.log('\n📡 CONSOLE LOGS:');
    if (consoleLogs.length > 0) {
      consoleLogs.forEach(log => console.log(`  ${log}`));
    } else {
      console.log('  (No console messages)');
    }

    console.log('\n🌐 NETWORK ERRORS:');
    if (networkErrors.length > 0) {
      networkErrors.forEach(error => console.log(`  ❌ ${error}`));
    } else {
      console.log('  ✅ No network errors detected');
    }

    // Get page HTML to analyze form structure
    console.log('\n📄 FORM HTML STRUCTURE:');
    const formHTML = await page.locator('form').first().innerHTML();
    if (formHTML) {
      // Print first 2000 chars of form HTML
      console.log(formHTML.substring(0, 2000));
      if (formHTML.length > 2000) {
        console.log(`... (${formHTML.length} total characters)`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testContactForm();
