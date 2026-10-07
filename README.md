# IDX Exchange Agentic AI

An OpenClaw-based multi-agent real estate assistant for an IDX Exchange internship.

## Repository Layout

- `docs/`: Architecture documentation and query lifecycle diagrams.
- `skills/`: OpenClaw skill definitions (e.g. `property-search`).
- `property-nlp/`: OpenClaw tool plugin providing natural language query parsing (`parse_property_query`).
- `time-tools/`: OpenClaw tool plugin providing the `get_current_time` tool.

## Building and Testing

Inside either `property-nlp/` or `time-tools/`:

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```
