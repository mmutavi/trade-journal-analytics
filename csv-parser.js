(function (root) {
  'use strict';

  const HEADER_ALIASES = {
    timestamp: ['timestamp', 'date', 'datetime', 'time', 'filled at', 'executed at', 'opened at', 'closed at'],
    symbol: ['symbol', 'ticker', 'asset', 'instrument', 'pair', 'market'],
    side: ['side', 'action', 'direction', 'trade side', 'position side'],
    quantity: ['quantity', 'qty', 'shares', 'size', 'units', 'filled qty', 'contracts'],
    price: ['price', 'fill price', 'average price', 'execution price'],
    entryPrice: ['entry price', 'avg entry price', 'average entry', 'open price'],
    exitPrice: ['exit price', 'avg exit price', 'average exit', 'close price'],
    pnl: ['pnl', 'p&l', 'realized pnl', 'realized p&l', 'profit/loss', 'net pnl', 'net p&l', 'profit', 'gain loss'],
    fees: ['fees', 'fee', 'commission', 'commissions', 'transaction fee'],
    tradeId: ['trade id', 'trade', 'order id', 'position id']
  };

  function parseRows(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"' && field.length === 0) quoted = true;
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(cell => cell.trim() !== '')) rows.push(row);
        row = [];
      } else field += char;
    }
    row.push(field);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
    return rows;
  }

  function normalizeHeader(value) {
    return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  }

  function numeric(value) {
    if (value == null || String(value).trim() === '') return null;
    let clean = String(value).trim().replace(/[\s$€£¥]/g, '');
    const parentheses = /^\(.*\)$/.test(clean);
    clean = clean.replace(/[(),]/g, '');
    const num = Number(clean);
    return Number.isFinite(num) ? (parentheses ? -num : num) : null;
  }

  function parseDate(value, fallbackIndex) {
    if (!value || !value.trim()) return { date: null, sortTime: Number.MAX_SAFE_INTEGER + fallbackIndex };
    const millis = Date.parse(value.trim());
    if (!Number.isFinite(millis)) return { date: null, sortTime: Number.MAX_SAFE_INTEGER + fallbackIndex };
    return { date: new Date(millis), sortTime: millis };
  }

  function parse(text) {
    const rows = parseRows(text);
    if (rows.length < 2) throw new Error('This file does not have a header row and any trade rows.');
    const headers = rows[0].map(normalizeHeader);
    const columns = {};
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      columns[key] = headers.findIndex(header => aliases.includes(header));
    }
    if (columns.symbol < 0) throw new Error('Could not find a symbol column. Try Symbol, Ticker, or Asset.');
    if (columns.side < 0 && columns.pnl < 0) throw new Error('Could not find Side/Action or a realized PnL column.');