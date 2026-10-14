# Property DB Plugin (`openclaw-plugin-property-db`)

OpenClaw database query plugin for real estate active listings (`rets_property`) and historical sold comps (`california_sold`).

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
