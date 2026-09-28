(function (root) {
  'use strict';
  const sum = values => values.reduce((total, value) => total + value, 0);
  const average = values => values.length ? sum(values) / values.length : 0;
  const round = (number, places = 2) => Number(number.toFixed(places));

  function summarize(trades) {
    const pnlValues = trades.map(trade => trade.pnl);
    const wins = trades.filter(trade => trade.pnl > 0);
    const losses = trades.filter(trade => trade.pnl < 0);
    const grossWin = sum(wins.map(trade => trade.pnl));
    const grossLoss = Math.abs(sum(losses.map(trade => trade.pnl)));
    const netPnl = sum(pnlValues);
    let equity = 0, peak = 0, maxDrawdown = 0;
    const datedEquity = new Map();
    for (const trade of trades) {
      equity += trade.pnl;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (trade.date) {
        const key = trade.date.toISOString().slice(0, 10);
        datedEquity.set(key, (datedEquity.get(key) || 0) + trade.pnl);
      }
    }
    const daily = [...datedEquity.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, pnl]) => ({ date, pnl: round(pnl) }));
    let cumulative = 0;
    const equityCurve = daily.map(day => ({ date: day.date, pnl: day.pnl, equity: round(cumulative += day.pnl) }));
    const bySymbol = new Map();
    for (const trade of trades) {
      if (!bySymbol.has(trade.symbol)) bySymbol.set(trade.symbol, []);
      bySymbol.get(trade.symbol).push(trade);
    }
    const symbols = [...bySymbol.entries()].map(([symbol, items]) => ({ symbol, trades: items.length, pnl: round(sum(items.map(t => t.pnl))), winRate: items.length ? winsRate(items) : 0 })).sort((a, b) => b.pnl - a.pnl);
    return {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      breakeven: trades.length - wins.length - losses.length,
      netPnl: round(netPnl),
      winRate: trades.length ? wins.length / trades.length * 100 : 0,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
      expectancy: trades.length ? netPnl / trades.length : 0,
      averageWin: average(wins.map(t => t.pnl)),
      averageLoss: average(losses.map(t => t.pnl)),
      maxDrawdown: round(maxDrawdown),
      bestTrade: trades.length ? Math.max(...pnlValues) : 0,
      worstTrade: trades.length ? Math.min(...pnlValues) : 0,
      daily,
      equityCurve,
      symbols,
      bySymbol,
      bySide: ['long', 'short'].map(side => {
        const items = trades.filter(t => t.side === side);
        return { side, trades: items.length, pnl: round(sum(items.map(t => t.pnl))), winRate: items.length ? winsRate(items) : null };
      })
    };
  }