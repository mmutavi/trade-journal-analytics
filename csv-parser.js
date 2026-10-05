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

    const warnings = [];
    const records = [];
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const get = key => columns[key] >= 0 ? (cells[columns[key]] ?? '').trim() : '';
      const symbol = get('symbol').toUpperCase();
      if (!symbol) { skipped++; continue; }
      const sideText = get('side').toLowerCase();
      let side = null;
      if (/\b(short|sell|sold|s)\b/.test(sideText)) side = 'short';
      else if (/\b(long|buy|bought|buy to cover|cover|b)\b/.test(sideText)) side = 'long';
      if (columns.side >= 0 && !side && columns.pnl < 0) { skipped++; continue; }
      const { date, sortTime } = parseDate(get('timestamp'), i);
      if (get('timestamp') && !date) warnings.push(`Row ${i + 1}: date could not be read; it will appear as undated.`);
      const quantity = Math.abs(numeric(get('quantity')) ?? 0);
      const price = numeric(get('price'));
      const entryPrice = numeric(get('entryPrice'));
      const exitPrice = numeric(get('exitPrice'));
      const pnl = numeric(get('pnl'));
      const fees = Math.abs(numeric(get('fees')) ?? 0);
      const directClosed = pnl !== null && (entryPrice !== null || exitPrice !== null || price === null || !side);
      records.push({ rowNumber: i + 1, symbol, side, quantity, price, entryPrice, exitPrice, pnl, fees, directClosed, date, sortTime, tradeId: get('tradeId') });
    }
    if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped because required values were missing.`);
    if (!records.length) throw new Error('No usable trade rows found. Check that the file has valid symbols and trade data.');
    return { records, warnings, columns, rowCount: rows.length - 1 };
  }

  function buildClosedTrades(parsed) {
    const trades = [];
    const lotsBySymbol = new Map();
    const records = parsed.records.slice().sort((a, b) => a.sortTime - b.sortTime || a.rowNumber - b.rowNumber);
    for (const record of records) {
      if (record.directClosed) {
        // Exported realized PnL is treated as net as many brokers already subtract fees.
        const net = record.pnl;
        const gross = net + record.fees;
        const entry = record.entryPrice ?? (record.side === 'short' ? record.exitPrice : record.price);
        const exit = record.exitPrice ?? record.price;
        trades.push({ symbol: record.symbol, side: record.side || 'unknown', quantity: record.quantity || null, entryPrice: entry, exitPrice: exit, grossPnl: gross, fees: record.fees, pnl: net, date: record.date, rowNumber: record.rowNumber, tradeId: record.tradeId, source: 'direct' });
        continue;
      }
      if (!record.side || !record.quantity || record.price === null) {
        parsed.warnings.push(`Row ${record.rowNumber}: needs Side, Quantity, and Price to reconstruct a round trip.`);
        continue;
      }
      if (!lotsBySymbol.has(record.symbol)) lotsBySymbol.set(record.symbol, []);
      let remaining = record.quantity;
      let signedQuantity = record.side === 'long' ? remaining : -remaining;
      let queue = lotsBySymbol.get(record.symbol);
      while (remaining > 1e-10 && queue.length && Math.sign(queue[0].signedQuantity) !== Math.sign(signedQuantity)) {
        const lot = queue[0];
        const matched = Math.min(remaining, Math.abs(lot.signedQuantity));
        const entryFee = lot.fee * (matched / Math.abs(lot.signedQuantity));
        const exitFee = record.fees * (matched / record.quantity);
        const rawPnl = lot.signedQuantity > 0 ? (record.price - lot.price) * matched : (lot.price - record.price) * matched;
        trades.push({ symbol: record.symbol, side: lot.signedQuantity > 0 ? 'long' : 'short', quantity: matched, entryPrice: lot.price, exitPrice: record.price, grossPnl: rawPnl, fees: entryFee + exitFee, pnl: rawPnl - entryFee - exitFee, date: record.date, rowNumber: record.rowNumber, tradeId: record.tradeId, source: 'fills' });
        lot.signedQuantity += Math.sign(signedQuantity) * matched;
        lot.fee -= entryFee;
        remaining -= matched;
        if (Math.abs(lot.signedQuantity) < 1e-10) queue.shift();
      }
      if (remaining > 1e-10) queue.push({ signedQuantity: Math.sign(signedQuantity) * remaining, price: record.price, fee: record.fees * (remaining / record.quantity), date: record.date });
    }
    trades.sort((a, b) => (a.date?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.date?.getTime() ?? Number.MAX_SAFE_INTEGER) || a.rowNumber - b.rowNumber);
    const openPositions = [...lotsBySymbol.entries()].flatMap(([symbol, queue]) => queue.map(lot => ({ symbol, side: lot.signedQuantity > 0 ? 'long' : 'short', quantity: Math.abs(lot.signedQuantity) })));
    if (openPositions.length) parsed.warnings.push(`${openPositions.length} unmatched opening position${openPositions.length === 1 ? '' : 's'} excluded from closed-trade stats.`);
    return { trades, openPositions };
  }

  root.TradeCSV = { parse, buildClosedTrades, numeric };
})(window);
