# Property DB Plugin (`openclaw-plugin-property-db`)

OpenClaw database query plugin for real estate active listings (`rets_property`), historical sold comps (`california_sold`), and market statistics / trend analysis.

## Tools
- `query_property_mls`: Query active listings and/or sold comps with pagination and formatted cards. Also supports `mode: "stats"` and `mode: "semantic"`.
- `get_market_statistics`: Calculate real estate market statistics for any California city/zip:
  - Median and average close price
  - Average price per square foot
  - Average days on market (DOM)
  - List-to-close price ratio (buyer vs. seller leverage indicator)
  - Inventory comparison (`rets_property` active listings vs. `california_sold` volume & months of inventory)
  - Month-over-Month (MoM) and Year-over-Year (YoY) price trends
  - Mobile-friendly WhatsApp markdown summaries with actionable market climate verdicts
- `semantic_property_search`: Semantic similarity search using vector embeddings and cosine similarity:
  - Generates embeddings using **Google Gemini** (free via `GEMINI_API_KEY`) or **OpenAI** (`OPENAI_API_KEY`)
  - Embeds listing descriptions (`rets_property.L_Remarks`) combined with structured specs (type, city, beds, baths, sq ft, year built, price)
  - Finds the top 5 semantically similar active listings matching free-text lifestyle/aesthetic queries
  - WhatsApp cards with match score percentages and highlighted remarks snippets

## Requirements
- Node.js 20+
- Local or remote MySQL instance with `idx_exchange` database.
- Environment variables:
  - `MYSQL_HOST`
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`
  - `GEMINI_API_KEY` (free tier via Google AI Studio) or `OPENAI_API_KEY`

## Scripts
- `npm run build`: Compile TypeScript.
- `npm run plugin:validate`: Validate OpenClaw plugin contract.
- `npm test`: Run Vitest unit tests (using mocked pool).


## Week 7 recommendations

`recommend_properties({ listingId: "ABC123", topK: 5, filters: { maxPrice: 1000000 } })`
returns up to five other active listings. Ranking combines handbook structured points
(price 20, bedrooms 15, city 15, living area 10) with cosine similarity × 40.
Each match includes the score breakdown, match reasons, existing property card,
and a `california_sold` price comparison (same city, residential, six months,
±20% living area). Missing comps return `insufficient_data` and null estimates.

The engine embeds at most 100 candidates shortlisted by structured score, so results
are best within that shortlist. It reuses the configured embedding provider without
persistent caching. Errors are returned explicitly rather than as successful empty matches.
The agent workflow is in `skills/recommendation/SKILL.md`.
