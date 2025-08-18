<script>
  export let scraping;
  export let urls;
  export let paused;
  export let results;
  export let progress;
  export let startScraping;
  export let pauseScraping;
  export let resumeScraping;
  export let stopScraping;
  export let openExportPopup;
  export let clearResults;
</script>

<div>
  <button on:click={startScraping} disabled={scraping || !urls.length}
    >Start Scraping</button
  >
  <button
    on:click={() => {
      paused ? resumeScraping() : pauseScraping();
    }}
    disabled={!scraping}>{paused ? "Resume" : "Pause"}</button
  >
  <button on:click={stopScraping} disabled={!scraping}>Stop</button>
  <button on:click={openExportPopup} disabled={!results.length}
    >Export CSV</button
  >
  <button
    on:click={clearResults}
    disabled={!results.length && !scraping && !progress}>Clear</button
  >
</div>
