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

  function winsRate(trades) { return trades.length ? trades.filter(t => t.pnl > 0).length / trades.length * 100 : 0; }

  function findings(summary, trades) {
    if (!trades.length) return [];
    const notes = [];
    const sampleWarning = count => count < 8 ? 'Small sample; treat this as a clue, not a reliable pattern.' : '';
    const sideResults = summary.bySide.filter(item => item.trades >= 4).sort((a, b) => b.pnl - a.pnl);
    if (sideResults.length) {
      const best = sideResults[0];
      notes.push({ icon: best.pnl >= 0 ? '↗' : '↘', tone: best.pnl >= 0 ? 'good' : 'warn', title: `${best.side === 'long' ? 'Longs' : 'Shorts'} were the stronger side`, body: `${best.trades} closed trades · ${money(best.pnl)} net · ${best.winRate.toFixed(0)}% win rate. ${sampleWarning(best.trades)}` });
    }
    const symbols = summary.symbols.filter(item => item.trades >= 3);
    if (symbols.length >= 2) {
      const best = symbols[0], worst = symbols[symbols.length - 1];
      notes.push({ icon: '◎', tone: best.pnl >= 0 ? 'good' : 'warn', title: `${best.symbol} led this sample`, body: `${best.trades} trades contributed ${money(best.pnl)}; ${worst.symbol} was lowest at ${money(worst.pnl)}. These are historical results, not a forecast.` });
    }
    const sorted = trades.filter(t => t.date).slice().sort((a, b) => a.date - b.date);
    const perDay = new Map();
    for (const trade of sorted) {
      const day = trade.date.toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) || 0) + 1);
    }
    const busyDay = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
    if (busyDay && busyDay[1] >= 5) {
      const dailyPnl = summary.daily.find(d => d.date === busyDay[0])?.pnl ?? 0;
      notes.push({ icon: '◷', tone: 'warn', title: 'A busy session stands out', body: `${busyDay[1]} closed trades on ${formatDate(busyDay[0])} netted ${money(dailyPnl)}. Review the sequence and whether your planned limits were followed.` });
    }
    const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
    if (wins.length >= 3 && losses.length >= 3) {
      const ratio = average(wins.map(t => t.pnl)) / Math.abs(average(losses.map(t => t.pnl)));
      notes.push({ icon: ratio >= 1 ? '�' : '!', tone: ratio >= 1 ? 'good' : 'warn', title: ratio >= 1 ? 'Average win outweighed average loss' : 'Losses were larger than wins on average', body: `Average win ${money(average(wins.map(t => t.pnl)))} vs. average loss ${money(average(losses.map(t => t.pnl)))} (ratio ${ratio.toFixed(2)}). ${sampleWarning(trades.length)}` });
    }
    if (!notes.length) notes.push({ icon: '◌', tone: 'warn', title: 'More trades will make comparisons useful', body: 'This upload has limited groups to compare. The numbers above describe this file only and do not establish why a strategy worked.' });
    return notes.slice(0, 4);
  }

  function money(value, currency = 'USD') {
    const abs = Math.abs(value);
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(abs);
    return value < 0 ? `−${formatted}` : formatted;
  }
  function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  root.TradeAnalytics = { summarize, findings, money, formatDate, round };
})(window);
