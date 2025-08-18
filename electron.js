import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrape } from './scraper.js';

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
    const concurrency = 10; // Change to 5 for higher concurrency if desired
    let currentIndex = 0;
    let running = 0;
    let results = new Array(scrapingQueue.length);

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
            mainWindow.webContents.send('scrape-result', { ...res, index: myIndex, processed, total: scrapingQueue.length });
        } catch (err) {
            results[myIndex] = { emails: [], url, pageTitle: '', error: err.message };
        }
        running--;
        if (currentIndex < scrapingQueue.length) {
            runNext();
        } else if (running === 0) {
            mainWindow.webContents.send('scrape-done');
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
ipcMain.on('scrape-stop', () => {
    scrapingActive = false;
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
    win.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
