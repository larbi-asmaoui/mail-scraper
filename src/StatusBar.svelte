<script>
  export let scrapingStatus;
  export let processed;
  export let total;
  export let found;
  export let noEmail;
  export let errors;
  export let progress;
</script>

<div class="status-and-progress">
  <div class="status">
    <span>{scrapingStatus}</span><br />
    <span>
      Total: {total} | Processed: {processed} | Emails found: {found} | No email:
      {noEmail} | Errors:
      {errors}
    </span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" style="width:{progress}%">
      {progress.toFixed(2)}%
    </div>
  </div>
</div>
