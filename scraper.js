import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import he from 'he'
import { decode } from "cf-email-decode"

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
    email = email.split('?')[0].trim().replace(/[^\w@.\-+%]/g, '');
    email = email.toLowerCase();

    // Format check
    const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);
    if (!valid) return null;

    // Exclude image file-like emails
    const ext = email.split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif'];
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


export async function scrape(url) {
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

        // Text nodes (NEW ADDITION)
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

        // Clean + deduplicate
        emails = Array.from(new Set(emails.map(cleanEmail).filter(Boolean)));

        return { emails, url, pageTitle };
    } catch (err) {
        return { emails: [], url, pageTitle: '', error: err.message };
    }
}
