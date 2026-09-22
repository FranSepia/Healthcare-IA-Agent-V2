(() => {
  // There is no backend tracking which real search results have moved into
  // a pursuit pipeline, so this tab has nothing real to show yet — render
  // an honest empty state instead of fabricated stages, owners and plans.
  function renderStage() {
    const metrics = document.querySelector('#pipelineMetrics');
    if (metrics) metrics.innerHTML = '';
    const mapping = document.querySelector('#statusMapping');
    if (mapping) mapping.remove();
    const title = document.querySelector('#selectedStageTitle');
    if (title) title.textContent = 'No opportunities in the pipeline yet';
    const copy = document.querySelector('#selectedStageCopy');
    if (copy) copy.textContent = 'Pipeline tracking is not connected to real data yet.';
    const table = document.querySelector('#pipelineTable');
    if (table) table.innerHTML = '';
  }
  function renderPlans() {
    const box = document.querySelector('#proposalPlans');
    if (box) box.innerHTML = '';
  }
  function renderDeliveryPlan() {
    const box = document.querySelector('#deliveryPlan');
    if (box) box.innerHTML = '<p style="padding:18px 4px;color:var(--muted);font-size:13px">No active proposal to show yet.</p>';
  }

  window.renderPipeline = renderStage;
  document.addEventListener('DOMContentLoaded', () => { renderStage(); renderPlans(); renderDeliveryPlan(); });
})();
