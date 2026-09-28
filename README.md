# IDX Exchange Agentic AI

An OpenClaw-based multi-agent real estate assistant for an IDX Exchange internship.

## Repository Layout

- `docs/`: Architecture documentation and query lifecycle diagrams.
- `time-tools/`: OpenClaw tool plugin providing the `get_current_time` tool.

## Building and Testing time-tools

Run the following commands inside `time-tools/`:

```bash
cd time-tools
npm install
npm run plugin:build
npm run plugin:validate
npm test
```
