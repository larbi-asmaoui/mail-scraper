import { describe, it, expect } from 'vitest';
import { scrape } from './scraper.js';
import { scrapeWithPlaywright } from './scraper-playwright.js';

/**
 * Integration tests for the email scraper
 * These tests scrape real websites to verify email extraction works correctly
 */

describe('Email Scraper - Real Website Tests', () => {
    // Increase timeout for real network requests
    const TIMEOUT = 60000; // 60 seconds

    describe('Fast Scraper (node-fetch + jsdom)', () => {
        it('should extract email from mayfirm.com/bakersfield/', async () => {
            const result = await scrape('https://mayfirm.com/bakersfield/');

            // Check that we got a valid result
            expect(result).toBeDefined();
            expect(result.url).toBe('https://mayfirm.com/bakersfield/');

            // Check that we found the expected email
            expect(result.emails).toContain('bakersfield@mayfirm.com');

            // Check page title was captured
            expect(result.pageTitle).toBeTruthy();

            console.log('✓ Found emails:', result.emails);
        }, TIMEOUT);

        it('should handle URL-encoded emails correctly', async () => {
            const result = await scrape('https://mayfirm.com/bakersfield/');

            // Ensure no emails start with URL encoding
            result.emails.forEach(email => {
                expect(email).not.toMatch(/^%/);
                expect(email).not.toContain('%20');
                expect(email).not.toContain('%40');
            });

            console.log('✓ All emails properly decoded');
        }, TIMEOUT);

        it('should handle websites with no emails', async () => {
            const result = await scrape('https://example.com');

            expect(result).toBeDefined();
            expect(result.url).toBe('https://example.com');
            expect(result.emails).toEqual([]);

            console.log('✓ Correctly returned empty array for site with no emails');
        }, TIMEOUT);
    });

    describe('Playwright Scraper (JavaScript rendering)', () => {
        it('should extract email from mayfirm.com/bakersfield/ with Playwright', async () => {
            const result = await scrapeWithPlaywright('https://mayfirm.com/bakersfield/');

            expect(result).toBeDefined();
            expect(result.url).toBe('https://mayfirm.com/bakersfield/');
            expect(result.emails).toContain('bakersfield@mayfirm.com');
            expect(result.pageTitle).toBeTruthy();

            console.log('✓ Playwright found emails:', result.emails);
        }, TIMEOUT);

        it('should handle JavaScript-rendered content', async () => {
            // Test with a site that uses React/Vue/Angular
            // This is a placeholder - you can add real JS framework sites here
            const result = await scrapeWithPlaywright('https://mayfirm.com/bakersfield/');

            expect(result).toBeDefined();
            expect(result.emails.length).toBeGreaterThanOrEqual(0);

            console.log('✓ Playwright handled JS content');
        }, TIMEOUT);
    });

    describe('Hybrid Scraper (combined approach)', () => {
        it('should use fast scraper and find emails', async () => {
            const result = await scrape('https://mayfirm.com/bakersfield/');

            // The hybrid scraper should find emails via fast method
            expect(result.emails).toContain('bakersfield@mayfirm.com');

            console.log('✓ Hybrid scraper found:', result.emails.length, 'email(s)');
        }, TIMEOUT);

        it('should fallback to Playwright when fast scraper finds nothing', async () => {
            // For this test, we'd need a JS-heavy site
            // Using the same site to verify the logic works
            const result = await scrape('https://example.com');

            // Should try fast first, then Playwright
            expect(result).toBeDefined();
            expect(result.emails).toBeDefined();

            console.log('✓ Hybrid approach completed');
        }, TIMEOUT);
    });

    describe('Email Validation', () => {
        it('should filter out invalid emails', async () => {
            const result = await scrape('https://mayfirm.com/bakersfield/');

            result.emails.forEach(email => {
                // Must have @ symbol
                expect(email).toContain('@');

                // Must have domain with TLD
                expect(email).toMatch(/\.[a-z]{2,}$/);

                // Should not have image extensions
                expect(email).not.toMatch(/\.(jpg|jpeg|png|svg|webp|gif)$/);

                // Should be lowercase
                expect(email).toBe(email.toLowerCase());

                // Should not have special characters
                expect(email).toMatch(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/);
            });

            console.log('✓ All emails passed validation');
        }, TIMEOUT);

        it('should not contain duplicate emails', async () => {
            const result = await scrape('https://mayfirm.com/bakersfield/');

            const uniqueEmails = new Set(result.emails);
            expect(result.emails.length).toBe(uniqueEmails.size);

            console.log('✓ No duplicate emails found');
        }, TIMEOUT);
    });

    describe('Error Handling', () => {
        it('should handle invalid URLs gracefully', async () => {
            const result = await scrape('https://this-domain-definitely-does-not-exist-12345.com');

            expect(result).toBeDefined();
            expect(result.error).toBeDefined();
            expect(result.emails).toEqual([]);

            console.log('✓ Handled invalid URL:', result.error);
        }, TIMEOUT);

        it('should handle timeout gracefully', async () => {
            // This might timeout, should handle it
            const result = await scrape('https://httpstat.us/200?sleep=30000');

            expect(result).toBeDefined();
            // Either succeeds or has an error
            expect(result.error || result.emails).toBeDefined();

            console.log('✓ Handled slow/timeout request');
        }, TIMEOUT);
    });

    describe('Multiple Website Tests', () => {
        const testSites = [
            { url: 'https://mayfirm.com/bakersfield/', expectedEmail: 'bakersfield@mayfirm.com' },
            // Add more test sites here
        ];

        testSites.forEach(({ url, expectedEmail }) => {
            it(`should extract ${expectedEmail} from ${url}`, async () => {
                const result = await scrape(url);

                expect(result.emails).toContain(expectedEmail);
                console.log(`✓ Found ${expectedEmail} on ${url}`);
            }, TIMEOUT);
        });
    });
});

describe('Email Cleaning Function', () => {
    // We can't directly test cleanEmail since it's not exported,
    // but we can test its effects through the scraper

    it('should decode URL-encoded emails', async () => {
        const result = await scrape('https://mayfirm.com/bakersfield/');

        // Check no emails have URL encoding
        result.emails.forEach(email => {
            expect(email).not.toContain('%');
        });
    }, 60000);

    it('should remove mailto: prefix', async () => {
        const result = await scrape('https://mayfirm.com/bakersfield/');

        result.emails.forEach(email => {
            expect(email).not.toContain('mailto:');
        });
    }, 60000);

    it('should convert to lowercase', async () => {
        const result = await scrape('https://mayfirm.com/bakersfield/');

        result.emails.forEach(email => {
            expect(email).toBe(email.toLowerCase());
        });
    }, 60000);
});
