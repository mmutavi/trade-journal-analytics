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

  async function importFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) return notify('Choose a .csv file to import.');
    try {
      const parsed = TradeCSV.parse(await file.text());
      const { trades, openPositions } = TradeCSV.buildClosedTrades(parsed);
      if (!trades.length) return notify('No closed trades found. Check your CSV columns and matching opening/closing fills.');
      state.allTrades = trades;
      state.sourceName = file.name;
      state.warnings = [...new Set(parsed.warnings)];
      $('#file-name').textContent = file.name;
      $('#file-name').title = `${trades.length} closed trades${openPositions.length ? ` · ${openPositions.length} open positions excluded` : ''}`;
      $('#data-notice').hidden = state.warnings.length === 0;
      $('#data-notice').innerHTML = state.warnings.slice(0, 4).map(message => `<div>${escapeHtml(message)}</div>`).join('');
      render();
      notify(`${trades.length} closed trades loaded in this tab.`);
    } catch (error) { notify(error.message || 'Could not read this CSV.'); }
  }

  async function loadSample() {
    try {
      const parsed = TradeCSV.parse(window.SampleTradeCSV);
      state.allTrades = TradeCSV.buildClosedTrades(parsed).trades;
      state.sourceName = 'Sample trades (synthetic)';
      state.warnings = [];
      $('#file-name').textContent = state.sourceName;
      $('#file-name').title = 'Synthetic example data, not actual account activity';
      $('#data-notice').hidden = true;
      render();
      notify('Loaded synthetic sample data.');
    } catch (error) { notify(error.message || 'Could not load sample data.'); }
  }

  function clearData() {
    state.allTrades = []; state.sourceName = ''; state.warnings = [];
    $('#file-name').textContent = 'Imported trades'; $('#file-name').title = '';
    $('#data-notice').hidden = true;
    $('#trade-search').value = ''; state.search = '';
    render();
  }

  function inPeriod(trades) {
    if (state.period === 'all') return trades;
    const dated = trades.filter(trade => trade.date);
    if (!dated.length) return trades;
    const latest = Math.max(...dated.map(trade => trade.date.getTime()));
    const days = state.period === '30d' ? 30 : 90;
    const cutoff = latest - days * 86400000;
    return trades.filter(trade => !trade.date || trade.date.getTime() >= cutoff);
  }

  function render() {
    const trades = inPeriod(state.allTrades);
    $('#empty-state').hidden = trades.length > 0;
    $('#dashboard').hidden = trades.length === 0;
    $('#clear-button').disabled = state.allTrades.length === 0;
    if (!trades.length) return;
    const summary = TradeAnalytics.summarize(trades);
    $('#metric-pnl').textContent = TradeAnalytics.money(summary.netPnl);
    $('#metric-pnl').className = `metric-value ${tone(summary.netPnl)}`;
    $('#metric-pnl-foot').textContent = `${summary.totalTrades} closed trades`;
    $('#metric-win-rate').textContent = `${summary.winRate.toFixed(1)}%`;
    $('#metric-win-foot').textContent = `${summary.wins} wins · ${summary.losses} losses`;
    $('#metric-profit-factor').textContent = Number.isFinite(summary.profitFactor) ? summary.profitFactor.toFixed(2) : (summary.profitFactor ? '∞' : '—');
    $('#metric-expectancy').textContent = TradeAnalytics.money(summary.expectancy);
    $('#metric-expectancy').className = `metric-value ${tone(summary.expectancy)}`;
    $('#metric-drawdown').textContent = TradeAnalytics.money(summary.maxDrawdown);
    $('#file-details').textContent = `${summary.totalTrades} closed trades`;
    $('#chart-period-label').textContent = state.period === 'all' ? 'All time' : `Last ${state.period === '30d' ? '30' : '90'} days`;
    renderChart(); renderSymbols(summary); renderInsights(summary, trades); renderTable();
  }

  function renderChart() { const trades = inPeriod(state.allTrades); if (trades.length) TradeCharts.draw(TradeAnalytics.summarize(trades), state.chartMode); }

  function renderSymbols(summary) {
    const list = $('#symbol-list');
    if (!summary.symbols.length) { list.innerHTML = '<div class="table-empty">No symbol values found.</div>'; return; }
    const max = Math.max(...summary.symbols.map(item => Math.abs(item.pnl)), 1);
    list.innerHTML = summary.symbols.slice(0, 7).map(item => `<div class="symbol-row"><div class="symbol-row-head"><span class="symbol-name">${escapeHtml(item.symbol)}</span><span class="symbol-amount ${tone(item.pnl)}">${TradeAnalytics.money(item.pnl)}</span></div><span class="symbol-track"><span class="symbol-bar ${item.pnl < 0 ? 'loss' : ''}" style="display:block;width:${Math.max(2, Math.abs(item.pnl) / max * 100)}%"></span></span><small>${item.trades} trades · ${item.winRate.toFixed(0)}% wins</small></div>`).join('');
  }

  function renderInsights(summary, trades) {
    const insights = TradeAnalytics.findings(summary, trades);
    $('#insight-grid').innerHTML = insights.map(item => `<article class="insight-card"><span class="insight-icon ${item.tone === 'warn' ? 'warn' : ''}">${escapeHtml(item.icon)}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div></article>`).join('');
  }

  function renderTable() {
    const body = $('#trade-rows');
    const trades = inPeriod(state.allTrades).filter(trade => !state.search || trade.symbol.toLowerCase().includes(state.search)).slice().reverse();
    $('#closed-count').textContent = String(inPeriod(state.allTrades).length);
    $('#table-summary').textContent = `Showing ${trades.length} of ${inPeriod(state.allTrades).length} trades`;
    $('#table-empty').hidden = trades.length > 0;
    if (!trades.length) { body.innerHTML = ''; return; }
    body.innerHTML = trades.map(trade => `<tr><td>${trade.date ? TradeAnalytics.formatDate(trade.date.toISOString().slice(0, 10)) : 'Undated'}</td><td><strong>${escapeHtml(trade.symbol)}</strong></td><td>${trade.side === 'long' || trade.side === 'short' ? `<span class="side-pill ${trade.side}">${trade.side === 'long' ? 'Long' : 'Short'}</span>` : '—'}</td><td class="numeric">${trade.quantity == null ? '—' : number(trade.quantity, 4)}</td><td class="numeric">${trade.entryPrice == null ? '—' : TradeAnalytics.money(trade.entryPrice)}</td><td class="numeric">${trade.exitPrice == null ? '—' : TradeAnalytics.money(trade.exitPrice)}</td><td class="numeric ${tone(trade.pnl)}">${TradeAnalytics.money(trade.pnl)}</td></tr>`).join('');
  }