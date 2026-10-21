# IDX Exchange Agentic AI

An OpenClaw-based multi-agent real estate assistant for an IDX Exchange internship.

## Repository Layout

- `docs/`: Architecture documentation and query lifecycle diagrams.
- `skills/`: OpenClaw skill definitions (e.g. `property-search` with conversational multi-turn session memory).
- `property-nlp/`: OpenClaw tool plugin providing natural language parsing and multi-turn session memory (`parse_property_query`, `get_user_session`, `update_user_session`, `clear_user_session`).
- `property-db/`: OpenClaw tool plugin providing MLS database integration (`query_property_mls`) with photo count support.
- `time-tools/`: OpenClaw tool plugin providing the `get_current_time` tool.

## Environment Variables

For `property-db` to query the local/remote MLS MySQL database, configure the following variables in your environment (see `.env.example`):

- `MYSQL_HOST`: MySQL database host (e.g., `localhost`)
- `MYSQL_USER`: Database username
- `MYSQL_PASSWORD`: Database password (can be empty string)
- `MYSQL_DATABASE`: Target database name (e.g., `idx_exchange`)

## Building and Testing

Inside `property-nlp/`, `property-db/`, or `time-tools/`:

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```
