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