(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const state = { trades: [], allTrades: [], sourceName: '', period: 'all', chartMode: 'equity', search: '', warnings: [] };
  const fileInput = $('#file-input');
  const dropZone = $('#drop-zone');

  $('#import-button').addEventListener('click', () => fileInput.click());
  $('#empty-import-button').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', event => { const file = event.target.files[0]; if (file) importFile(file); fileInput.value = ''; });
  $('#sample-button').addEventListener('click', loadSample);
  $('#empty-sample-button').addEventListener('click', loadSample);
  $('#clear-button').addEventListener('click', clearData);
  $('#period-filter').addEventListener('change', event => { state.period = event.target.value === 'all' ? 'all' : `${event.target.value}d`; render(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-chart]');
    if (!button) return;
    state.chartMode = button.dataset.chart;
    document.querySelectorAll('[data-chart]').forEach(item => item.classList.toggle('active', item === button));
    $('#chart-heading').textContent = state.chartMode === 'equity' ? 'Equity curve' : 'Daily P&L';
    $('#chart-legend-label').textContent = state.chartMode === 'equity' ? 'Cumulative net P&L' : 'Daily net P&L';
    renderChart();
  });
  $('#trade-search').addEventListener('input', event => { state.search = event.target.value.trim().toLowerCase(); renderTable(); });
  dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('over'); const file = event.dataTransfer.files[0]; if (file) importFile(file); });
  document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dropZone.classList.add('show'); } });
  document.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (file && !dropZone.contains(event.target)) { event.preventDefault(); importFile(file); }
    setTimeout(() => dropZone.classList.remove('show', 'over'), 80);
  });