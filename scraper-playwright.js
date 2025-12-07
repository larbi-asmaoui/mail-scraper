import { chromium } from 'playwright';

let browser = null;
let context = null;

// Initialize browser once and reuse
async function ensureBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });
    }
    return context;
}

// Clean email helper (same as scraper.js)
function cleanEmail(email) {
    if (!email) return null;

    // Strip "mailto:", query params, and trim
    if (email.startsWith('mailto:')) email = email.slice(7);
    email = email.split('?')[0].trim();

    // Decode URL encoding (%20, %40, etc.)
    try {
        email = decodeURIComponent(email);
    } catch (e) {
        // If decoding fails, continue with original
    }

    // Remove any non-email characters (no % allowed now)
    email = email.replace(/[^\w@.\-+]/g, '');
    email = email.toLowerCase();

    // Format check
    const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);
    if (!valid) return null;

    // Exclude image file-like emails
    const ext = email.split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'avif'];
    if (imageExts.includes(ext)) return null;

    // Exclude 32-char hex local parts (tracker emails)
    const [localPart] = email.split('@');
    if (/^[a-f0-9]{32}$/.test(localPart)) return null;

    return email;
}

// Extract emails from rendered page
export async function scrapeWithPlaywright(url) {
    let page = null;
    try {
        const ctx = await ensureBrowser();
        page = await ctx.newPage();

        // Set timeout and navigate
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Wait a bit more for any delayed JS
        await page.waitForTimeout(2000);

        const pageTitle = await page.title();
        const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

        let emails = [];

        // 1. Extract from page content (visible text)
        const bodyText = await page.textContent('body');
        const textEmails = bodyText.match(emailRegex) || [];
        emails.push(...textEmails);

        // 2. Extract from HTML content
        const htmlContent = await page.content();
        const htmlEmails = htmlContent.match(emailRegex) || [];
        emails.push(...htmlEmails);

        // 3. Extract from mailto links
        const mailtoLinks = await page.$$eval('a[href^="mailto:"]', links =>
            links.map(a => a.getAttribute('href'))
        );
        emails.push(...mailtoLinks);

        // 4. Extract from data attributes
        const dataEmails = await page.$$eval('[data-email]', elements =>
            elements.map(el => el.getAttribute('data-email'))
        );
        emails.push(...dataEmails);

        // 5. Look for emails in JavaScript variables
        const jsEmails = await page.evaluate(() => {
            const emails = [];
            const scripts = Array.from(document.querySelectorAll('script'));
            const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

            scripts.forEach(script => {
                if (script.textContent) {
                    const matches = script.textContent.match(emailPattern);
                    if (matches) emails.push(...matches);
                }
            });

            return emails;
        });
        emails.push(...jsEmails);

        // 6. Check JSON-LD structured data
        const jsonLdEmails = await page.evaluate(() => {
            const emails = [];
            const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

            jsonLdScripts.forEach(script => {
                try {
                    const data = JSON.parse(script.textContent);
                    const findEmails = (obj) => {
                        if (typeof obj === 'string' && obj.includes('@')) {
                            emails.push(obj);
                        } else if (typeof obj === 'object' && obj !== null) {
                            Object.values(obj).forEach(findEmails);
                        }
                    };
                    findEmails(data);
                } catch (e) {
                    // Invalid JSON, skip
                }
            });

            return emails;
        });
        emails.push(...jsonLdEmails);

        // Clean and deduplicate
        emails = Array.from(new Set(emails.map(cleanEmail).filter(Boolean)));

        await page.close();

        return { emails, url, pageTitle };
    } catch (err) {
        if (page) await page.close();
        return { emails: [], url, pageTitle: '', error: 'Playwright error: ' + err.message };
    }
}

// Cleanup function to close browser
export async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        context = null;
    }
}
