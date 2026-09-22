document.addEventListener('DOMContentLoaded', () => {
  const selectionBar = document.querySelector('#selectionBar');
  const selectedCount = document.querySelector('#selectedCount');
  const reviewButton = document.querySelector('#sendReview');

  document.querySelector('#todayList')?.addEventListener('change', () => {
    const count = document.querySelectorAll('#todayList input[type="checkbox"]:checked').length;
    selectionBar?.classList.toggle('show', count > 0);
    if (selectedCount) selectedCount.textContent = `${count} selected`;
    if (reviewButton) reviewButton.disabled = count === 0;
  });

  // The real excluded-opportunities list is rendered by live-search.js's
  // renderExcludedContent() once the first search resolves — this is just
  // the honest placeholder shown while that search is still running.
  const excluded = document.querySelector('#excludedContent');
  if (excluded) {
    excluded.innerHTML = '<p style="padding:18px 4px;color:var(--muted);font-size:13px">Running the first live search…</p>';
  }
});
