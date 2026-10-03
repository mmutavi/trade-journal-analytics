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