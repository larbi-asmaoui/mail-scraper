<script>
  export let exportColumns = [];
  export let selectedExportColumns = [];
  export let toggleExportColumn;
  export let exportCSV;
  export let closeExportPopup;
</script>

<div class="export-popup-bg">
  <div class="export-popup">
    <h3>Export Columns</h3>
    {#each exportColumns as col}
      <label style="display:block;margin-bottom:8px;">
        <input
          type="checkbox"
          checked={selectedExportColumns.includes(col)}
          on:change={() => toggleExportColumn(col)}
        />
        {col}
      </label>
    {/each}
    <div style="margin-top:16px;display:flex;gap:8px;">
      <button on:click={exportCSV} disabled={!selectedExportColumns.length}
        >Export</button
      >
      <button on:click={closeExportPopup}>Cancel</button>
    </div>
  </div>
</div>
