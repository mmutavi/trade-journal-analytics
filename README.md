# Trade Journal — Local Analytics

A small, static browser dashboard for reviewing paper-trading and broker-export CSV files. It has no build step, package install, account connection, API key, or external data service. Open `index.html` in a current browser and select a CSV. The built-in sample preview works without a server.

## What it shows

- Net realized P&L, win rate, profit factor, expectancy, and peak-to-trough drawdown.
- Cumulative equity and daily P&L charts.
- Realized results by symbol and a searchable closed-trade list.
- Plain-language comparisons of long and short trades, symbols, busy sessions, and average wins versus losses when there are enough trades to compare.
- A sample file with synthetic trades only.

All calculations describe the uploaded rows. They are not predictions, proof that a rule caused an outcome, or investment advice. Open positions are excluded from closed-trade performance.

## Privacy

The selected CSV is read in the browser tab and is not uploaded, saved to local storage, or sent to a server. Refreshing or closing the tab clears the imported data. The page uses no third-party scripts, analytics, font downloads, or network requests.

## CSV formats

Header names are case-insensitive. Common aliases are accepted.

### Closed-trade rows

Include a symbol (`symbol`, `ticker`, `asset`), a realized result (`pnl`, `realized pnl`, `net pnl`, `profit`), and optionally `timestamp`/`date`, `side`, `quantity`, `entry_price`, and `exit_price`.

An exported realized P&L value is assumed to already be net of fees. If the file also has a fee column, fees are shown only as context for gross P&L math and are not subtracted a second time. If a broker's P&L field is gross, use a net P&L column or subtract fees before import.

For these completed-trade rows, `side` should describe the position direction (`long` or `short`). A bare `buy` or `sell` can mean an order action in some exports, which does not always identify the direction of the closed position.

### Fill-by-fill rows

Include a symbol, `side`/`action` (buy/long or sell/short), `quantity`, `price`, optional `fees`, and optional `timestamp`. The app pairs opposing fills by symbol using FIFO, supports partial closes and reversals, and allocates fill fees across closed pieces. Any unmatched remainder is considered open and left out of closed-trade stats.

Exports vary. If the figures look wrong, check whether the file represents fills or completed trades, whether sells mean opening shorts or closing longs, how its P&L handles fees, and whether timestamps include a timezone. This simple importer cannot infer every broker's position/accounting conventions. Try the synthetic sample first, then compare a few rows with the source export.

## Files

- `index.html` — dashboard structure
- `styles.css` — responsive interface styling
- `app.js` — import, filters, and rendering
- `csv-parser.js` — CSV parsing and trade reconstruction
- `analytics.js` — summary calculations and descriptive findings
- `charts.js` — canvas charts
- `sample-data.js` — embedded synthetic preview for file:// use
- `sample-trades.csv` — downloadable/importable synthetic CSV

## Repo Updater note

Point Repo Updater at this project's folder to let it publish staggered code slices. Those releases are a publication schedule for code already written; they do not mean new features were built on each release date. For an honest portfolio record, describe the actual work and milestones accurately.
