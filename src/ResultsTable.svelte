<script>
  export let results = [];
</script>

<div class="table-container">
  <table class="results-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Email</th>
        <th>Website</th>
        <th>Page Title</th>
      </tr>
    </thead>
    <tbody>
      {#each results as row, i}
        <tr>
          <td>{i + 1}</td>
          <td>{row.email}</td>
          <td>{row.website}</td>
          <td class="truncate-title">{row.pageTitle}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
