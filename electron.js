import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrape } from './scraper.js';
import { closeBrowser } from './scraper-playwright.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let scrapingQueue = [];
let scrapingActive = false;
let scrapingPaused = false;
let mainWindow = null;

function startScrapingQueue(urls) {
    scrapingQueue = urls;
    scrapingActive = true;
    scrapingPaused = false;
    let processed = 0;
    const concurrency = 3; // Reduced from 10 to 3 to prevent freezing
    let currentIndex = 0;
    let running = 0;
    let results = new Array(scrapingQueue.length);
    let lastProgressUpdate = 0;

    async function runNext() {
        if (!scrapingActive) return;
        while (scrapingPaused) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        if (currentIndex >= scrapingQueue.length) return;
        const myIndex = currentIndex++;
        const url = scrapingQueue[myIndex];
        running++;
        try {
            const res = await scrape(url);
            processed++;
            results[myIndex] = res;

            // Throttle progress updates - only send every 500ms to prevent UI freezing
            const now = Date.now();
            if (now - lastProgressUpdate > 500 || processed === scrapingQueue.length) {
                mainWindow.webContents.send('scrape-result', {
                    ...res,
                    index: myIndex,
                    processed,
                    total: scrapingQueue.length
                });
                lastProgressUpdate = now;
            }
        } catch (err) {
            results[myIndex] = { emails: [], url, pageTitle: '', error: err.message };
        }
        running--;
        if (currentIndex < scrapingQueue.length) {
            runNext();
        } else if (running === 0) {
            mainWindow.webContents.send('scrape-done');
            // Cleanup Playwright browser after scraping is done
            await closeBrowser();
        }
    }

    // Start initial batch
    for (let i = 0; i < Math.min(concurrency, scrapingQueue.length); i++) {
        runNext();
    }
}


ipcMain.on('scrape-queue', (event, urls) => {
    startScrapingQueue(urls);
});
ipcMain.on('scrape-pause', () => {
    scrapingPaused = true;
});
ipcMain.on('scrape-resume', () => {
    scrapingPaused = false;
});
ipcMain.on('scrape-stop', async () => {
    scrapingActive = false;
    // Cleanup Playwright browser when stopped
    await closeBrowser();
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });
    mainWindow = win;
    // if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    // } else {
    //     // In production, load the built index.html from the dist directory
    //     win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    // }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
    // Cleanup Playwright browser before quitting
    await closeBrowser();
    if (process.platform !== 'darwin') app.quit();
});
