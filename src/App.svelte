<script>
  import { onMount } from "svelte";
  import FileUpload from "./FileUpload.svelte";
  import Toolbar from "./Toolbar.svelte";
  import ExportPopup from "./ExportPopup.svelte";
  import StatusBar from "./StatusBar.svelte";
  import ResultsTable from "./ResultsTable.svelte";
  let file = null;
  let fileInput;
  let columns = [];
  let selectedColumn = "";
  let urls = [];
  let total = 0;
  let scraping = false;
  let scrapingStatus = "";
  let currentScrapeUrl = "";
  let progress = 0;
  let results = [];
  let processed = 0;
  let found = 0;
  let noEmail = 0;
  let errors = 0;

  // Pause/Resume state
  let paused = false;

  // Export popup state
  let showExportPopup = false;
  let exportColumns = ["Email", "Website", "Page Title"];
  let selectedExportColumns = [...exportColumns];

  function openExportPopup() {
    showExportPopup = true;
    selectedExportColumns = [...exportColumns];
  }
  function closeExportPopup() {
    showExportPopup = false;
  }
  function toggleExportColumn(col) {
    if (selectedExportColumns.includes(col)) {
      selectedExportColumns = selectedExportColumns.filter((c) => c !== col);
    } else {
      selectedExportColumns = [...selectedExportColumns, col];
    }
  }

  // Parse a CSV line properly handling quoted values
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote (two consecutive quotes become one)
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Push the last field
    result.push(current.trim());
    
    return result;
  }

  function exportCSV() {
    // Build CSV string
    const header = selectedExportColumns.join(",");
    const rows = results.map((row) => {
      return selectedExportColumns
        .map((col) => {
          if (col === "Email") return row.email;
          if (col === "Website") return row.website;
          if (col === "Page Title") return row.pageTitle;
          return "";
        })
        .join(",");
    });
    const csv = [header, ...rows].join("\n");
    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeExportPopup();
  }

  // Handle file upload and parse CSV
  function handleFileUpload(event) {
    file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      const dataLines = lines.filter(
        (line) => line.trim() && !line.trim().startsWith("#")
      );
      if (dataLines.length === 0) {
        columns = [];
        urls = [];
        selectedColumn = "";
        return;
      }
      
      // Parse the header row using the CSV parser
      columns = parseCSVLine(dataLines[0]);
      
      if (!selectedColumn || !columns.includes(selectedColumn)) {
        selectedColumn = columns[0];
      }
      
      // Parse data rows and extract URLs from the selected column
      const columnIndex = columns.indexOf(selectedColumn);
      urls = dataLines
        .slice(1)
        .map((row) => {
          const cells = parseCSVLine(row);
          return cells[columnIndex];
        })
        .filter((url) => url && url.trim() !== "");

      console.log("Parsed columns:", columns);
      console.log("Selected column:", selectedColumn);
      console.log("Column index:", columnIndex);
      console.log("Parsed URLs:", urls.slice(0, 10)); // Log first 10 URLs
    };
    reader.readAsText(file);
  }

  // Start scraping
  function startScraping() {
    scraping = true;
    paused = false;
    scrapingStatus = "";
    results = [];
    processed = found = noEmail = errors = 0;
    progress = 0;
    window.electron.send("scrape-queue", urls);
  }

  function pauseScraping() {
    window.electron.send("scrape-pause");
    paused = true;
    scrapingStatus = "scraping paused";
  }
  function resumeScraping() {
    window.electron.send("scrape-resume");
    paused = false;
    scrapingStatus = "";
  }
  function stopScraping() {
    window.electron.send("scrape-stop");
    scraping = false;
    paused = false;
    scrapingStatus = "scraping stopped";
  }

  // Clear results and reset state
  function clearResults() {
    file = null;
    if (fileInput) fileInput.value = "";
    columns = [];
    urls = [];
    selectedColumn = "";
    results = [];
    processed = 0;
    found = 0;
    noEmail = 0;
    errors = 0;
    progress = 0;
    scrapingStatus = "";
    currentScrapeUrl = "";
    scraping = false;
    paused = false;
  }

  // Listen for results from Electron
  onMount(() => {
    window.electron.on("scrape-result", (event, res) => {
      console.log("Received from Electron:", res);
      total = res.total;
      processed = res.processed;
      progress = Math.round((res.processed / res.total) * 100);
      currentScrapeUrl = res.url;
      scrapingStatus = paused ? "scraping paused" : `scraping : ${res.url}`;
      if (res.emails && res.emails.length) {
        found += res.emails.length;
        res.emails.forEach((email) => {
          results = [
            ...results,
            { email, website: res.url, pageTitle: res.pageTitle },
          ];
        });
      } else {
        noEmail++;
      }
      if (res.error) errors++;
    });
    window.electron.on("scrape-done", () => {
      scraping = false;
      paused = false;
      scrapingStatus = "scraping complete";
    });
  });
</script>

<div class="main-layout">
  <div class="toolbar top-toolbar">
    <FileUpload
      {columns}
      bind:selectedColumn
      {handleFileUpload}
      bind:fileInput
    />
    <Toolbar
      {scraping}
      {urls}
      {paused}
      {results}
      {progress}
      {startScraping}
      {pauseScraping}
      {resumeScraping}
      {stopScraping}
      {openExportPopup}
      {clearResults}
    />
    {#if showExportPopup}
      <ExportPopup
        {exportColumns}
        {selectedExportColumns}
        {toggleExportColumn}
        {exportCSV}
        {closeExportPopup}
      />
    {/if}
  </div>
  <StatusBar
    {scrapingStatus}
    {total}
    {processed}
    {found}
    {noEmail}
    {errors}
    {progress}
  />
  <ResultsTable {results} />
</div>
