# Property DB Plugin (`openclaw-plugin-property-db`)

OpenClaw database query plugin for real estate active listings (`rets_property`), historical sold comps (`california_sold`), and market statistics / trend analysis.

## Tools
- `query_property_mls`: Query active listings and/or sold comps with pagination and formatted cards. Also supports `mode: "stats"`.
- `get_market_statistics`: Calculate real estate market statistics for any California city/zip:
  - Median and average close price
  - Average price per square foot
  - Average days on market (DOM)
  - List-to-close price ratio (buyer vs. seller leverage indicator)
  - Inventory comparison (`rets_property` active listings vs. `california_sold` volume & months of inventory)
  - Month-over-Month (MoM) and Year-over-Year (YoY) price trends
  - Mobile-friendly WhatsApp markdown summaries with actionable market climate verdicts

## Requirements
- Node.js 20+
- Local or remote MySQL instance with `idx_exchange` database.
- Environment variables:
  - `MYSQL_HOST`
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`

## Scripts
- `npm run build`: Compile TypeScript.
- `npm run plugin:validate`: Validate OpenClaw plugin contract.
- `npm test`: Run Vitest unit tests (using mocked pool).

