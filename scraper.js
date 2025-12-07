import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import he from 'he'
import { decode } from "cf-email-decode"
import { scrapeWithPlaywright } from './scraper-playwright.js';

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

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


function extractEmailsFromTextNodes(doc, emailRegex) {
    const emails = [];
    // Use NodeFilter from the global context
    const NodeFilter = doc.defaultView?.NodeFilter || global.NodeFilter || JSDOM.window.NodeFilter;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        const matches = node.nodeValue.match(emailRegex);
        if (matches) emails.push(...matches);
    }
    return emails;
}

// Fast scraping with node-fetch + jsdom
async function scrapeFast(url) {
    try {
        // Set a timeout for fetch (20s)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        let res;
        try {
            res = await fetch(url, {
                headers: { 'User-Agent': getRandomUserAgent() },
                signal: controller.signal,
            });
        } catch (fetchErr) {
            clearTimeout(timeout);
            return { emails: [], url, pageTitle: '', error: 'Fetch error: ' + fetchErr.message };
        }
        clearTimeout(timeout);

        const html = await res.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const pageTitle = doc.title || '';
        const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

        let emails = [];
        // Raw HTML
        const rawHtmlEmails = html.match(emailRegex) || [];
        emails.push(...rawHtmlEmails);

        // mailto: links
        const mailtos = Array.from(doc.querySelectorAll('a[href^="mailto:"]'));
        mailtos.forEach(a => {
            const mail = a.getAttribute('href');
            if (mail) emails.push(mail);
        });

        // HTML comments
        const walker = doc.createTreeWalker(doc, dom.window.NodeFilter.SHOW_COMMENT, null, false);
        let commentNode;
        while ((commentNode = walker.nextNode())) {
            const matches = commentNode.nodeValue.match(emailRegex);
            if (matches) emails.push(...matches);
        }

        // Text nodes
        emails.push(...extractEmailsFromTextNodes(doc, emailRegex));

        // Cloudflare protected emails
        const cfEmailSpans = Array.from(doc.querySelectorAll('span.__cf_email__[data-cfemail]'));
        cfEmailSpans.forEach(span => {
            try {
                const encoded = span.getAttribute('data-cfemail');
                if (encoded) {
                    const decoded = decode(encoded);
                    if (decoded) {
                        emails.push(decoded);
                    }
                }
            } catch (e) {
                // Ignore errors, continue scraping
                console.warn('Cloudflare email decode error:', e);
            }
        });

        // data-email attributes
        const dataEmailElements = Array.from(doc.querySelectorAll('[data-email]'));
        dataEmailElements.forEach(el => {
            const email = el.getAttribute('data-email');
            if (email) emails.push(email);
        });

        // Clean + deduplicate
        emails = Array.from(new Set(emails.map(cleanEmail).filter(Boolean)));

        return { emails, url, pageTitle };
    } catch (err) {
        return { emails: [], url, pageTitle: '', error: err.message };
    }
}

// Hybrid scraper: try fast first, fallback to Playwright if needed
export async function scrape(url) {
    // Try fast scraping first
    const fastResult = await scrapeFast(url);

    // If we found emails, return immediately
    if (fastResult.emails && fastResult.emails.length > 0) {
        console.log(`✓ Fast scrape found ${fastResult.emails.length} email(s) on ${url}`);
        return fastResult;
    }

    // If fast scraping had an error (not just no emails), return the error
    if (fastResult.error && !fastResult.error.includes('Fetch error')) {
        return fastResult;
    }

    // No emails found with fast method, try Playwright for JS-rendered content
    console.log(`⟳ Trying Playwright for ${url}...`);
    const playwrightResult = await scrapeWithPlaywright(url);

    if (playwrightResult.emails && playwrightResult.emails.length > 0) {
        console.log(`✓ Playwright found ${playwrightResult.emails.length} email(s) on ${url}`);
    } else {
        console.log(`✗ No emails found on ${url}`);
    }

    return playwrightResult;
}
