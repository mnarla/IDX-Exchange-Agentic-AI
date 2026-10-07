# Property NLP Plugin

Provides the `parse_property_query` tool to convert natural language queries into structured database filters for `rets_property`.

- **Semantics**: `minBeds`, `minBaths`, and `minSqft` are minimums (`>=`); `maxPrice` and `maxHOA` are maximums (`<=`).
- **Build and test**: `npm install`, `npm run plugin:build`, `npm run plugin:validate`, `npm test`.
