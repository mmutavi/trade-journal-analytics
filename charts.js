(function (root) {
  'use strict';
  let current = { summary: null, mode: 'equity' };
  const green = '#25825f', red = '#cf7470', grid = '#edf0ee', muted = '#919b95';

  function draw(summary, mode) {
    current = { summary, mode };
    const canvas = document.getElementById('performance-chart');
    if (!canvas || !summary) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    const width = bounds.width, height = bounds.height;
    ctx.clearRect(0, 0, width, height);
    const series = mode === 'daily' ? summary.daily.map(day => ({ label: day.date, value: day.pnl })) : summary.equityCurve.map(day => ({ label: day.date, value: day.equity }));
    if (!series.length) return emptyChart(ctx, width, height);
    const pad = { top: 16, right: 12, bottom: 28, left: 57 };
    const chartW = width - pad.left - pad.right, chartH = height - pad.top - pad.bottom;
    let min = Math.min(0, ...series.map(item => item.value));
    let max = Math.max(0, ...series.map(item => item.value));
    if (min === max) { min -= 1; max += 1; }
    const extra = (max - min) * .12;
    min -= extra; max += extra;
    const y = value => pad.top + (max - value) / (max - min) * chartH;
    const x = index => pad.left + (series.length < 2 ? chartW / 2 : index / (series.length - 1) * chartW);
    ctx.font = '10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const value = max - i * (max - min) / 4;
      const lineY = y(value);
      ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, lineY); ctx.lineTo(width - pad.right, lineY); ctx.stroke();
      ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(compactMoney(value), pad.left - 9, lineY);
    }
    const zeroY = y(0);
    ctx.strokeStyle = '#cbd3ce'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(width - pad.right, zeroY); ctx.stroke(); ctx.setLineDash([]);
    const positive = (mode === 'daily' ? summary.daily.reduce((total, day) => total + day.pnl, 0) : (series[series.length - 1]?.value || 0)) >= 0;
    const color = positive ? green : red;
    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, positive ? 'rgba(37,130,95,.18)' : 'rgba(207,116,112,.16)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    series.forEach((item, index) => index ? ctx.lineTo(x(index), y(item.value)) : ctx.moveTo(x(index), y(item.value)));
    if (mode === 'equity') { ctx.lineTo(x(series.length - 1), zeroY); ctx.lineTo(x(0), zeroY); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill(); }
    ctx.beginPath();
    series.forEach((item, index) => index ? ctx.lineTo(x(index), y(item.value)) : ctx.moveTo(x(index), y(item.value)));
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    if (series.length < 2) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(0), y(series[0].value), 4, 0, Math.PI * 2); ctx.fill(); }
    const labelIndices = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
    ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    labelIndices.forEach(index => { const label = new Date(`${series[index].label}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); ctx.fillText(label, x(index), height - pad.bottom + 10); });
  }
  function compactMoney(value) { const abs = Math.abs(value); const digits = abs >= 10000 ? `${(abs / 1000).toFixed(0)}k` : abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${abs.toFixed(0)}`; return `${value < 0 ? '−' : ''}$${digits}`; }
  function emptyChart(ctx, width, height) { ctx.fillStyle = muted; ctx.font = '12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('No dated trades to plot in this period', width / 2, height / 2); }
  window.addEventListener('resize', () => { if (current.summary) draw(current.summary, current.mode); });
  root.TradeCharts = { draw };
})(window);
