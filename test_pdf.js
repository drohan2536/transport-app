const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure().errorText));

    await page.goto('http://localhost:9091/dashboard', { waitUntil: 'networkidle' });

    console.log('Page loaded. Clicking download button...');

    // The download button inside an invoice card.
    // It's a button containing "📥" or similar, let's just click the first one if it exists.
    const downloadBtn = await page.$('button:has-text("📥"), button[title="Download PDF"], button.text-blue-600');
    if (downloadBtn) {
        await downloadBtn.click();
        console.log('Clicked download button. Waiting 3 seconds...');
        await page.waitForTimeout(3000);
    } else {
        console.log('No download button found.');
    }

    await browser.close();
})();
