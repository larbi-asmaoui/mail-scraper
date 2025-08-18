<script>
  export let columns = [];
  export let selectedColumn = "";
  export let handleFileUpload;
  export let fileInput;
</script>

<div>
  <input
    type="file"
    accept=".csv,.txt"
    on:change={handleFileUpload}
    bind:this={fileInput}
  />
  {#if columns.length}
    <label for="urlColumn">URL Column:</label>
    <select id="urlColumn" bind:value={selectedColumn}>
      {#each columns as col}
        <option value={col}>{col}</option>
      {/each}
    </select>
  {/if}
</div>
