# Mail Scraper Desktop App

Mail Scraper is an Electron.js + Node.js desktop application for extracting email addresses from a list of websites. It features a modern Svelte UI and robust scraping logic, making it easy to collect emails for outreach, research, or marketing.

## Features

- **CSV Import:** Upload a CSV or TXT file containing website URLs.
- **Column Selection:** Choose which column contains the URLs.
- **Smart Email Extraction:** Scrapes emails from visible text, HTML, `mailto:` links, and even comments.
- **Random User-Agent:** Uses random user-agents for each request to avoid detection.
- **Progress Tracking:** See real-time progress, current URL, and statistics (found, processed, errors, etc).
- **Pause/Resume/Stop:** Full control over the scraping process.
- **Export:** Download results as a CSV, with selectable columns.
- **Modern UI:** Built with Svelte for a fast, responsive experience.

## How It Works

1. **Upload** a CSV/TXT file with website URLs.
2. **Select** the column containing the URLs.
3. **Start Scraping.** The app will visit each site and extract emails.
4. **Pause, Resume, or Stop** as needed.
5. **Export** the results to CSV.

## Technologies Used

- Electron.js
- Node.js
- Svelte
- Vite

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/larbi-asmaoui/mail-scraper.git
   cd mail-scraper
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app:
   ```bash
   npm run electron
   ```

## Project Structure

- `src/` — Svelte UI components
- `scraper.js` — Email extraction logic
- `electron.js` — Electron main process
- `preload.js` — Secure context bridge
- `index.html`, `style.css` — App shell and styles

## License

MIT
