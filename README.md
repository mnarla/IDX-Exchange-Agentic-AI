# IDX Exchange Agentic AI

An OpenClaw-based multi-agent real estate assistant for an IDX Exchange internship.

## Repository Layout

- `docs/`: Architecture documentation and query lifecycle diagrams.
- `skills/`: OpenClaw skill definitions:
  - `property-search`: Conversational multi-turn property search with session memory.
  - `market-stats`: Market analytics agent responding to market queries with data-backed summaries, trends, and market climate assessment.
  - `semantic-search`: Semantic property search agent utilizing OpenAI vector embeddings (`text-embedding-3-small`) and cosine similarity over `rets_property.L_Remarks` to match qualitative, aesthetic, and architectural styles.
- `skills/recommendation/`: Week 7 hybrid listing recommendations with recent sold-comp price comparisons.
- `property-nlp/`: OpenClaw tool plugin providing natural language parsing and multi-turn session memory (`parse_property_query`, `get_user_session`, `update_user_session`, `clear_user_session`).
- `property-db/`: OpenClaw tool plugin providing MLS database integration (`query_property_mls`), market analytics (`get_market_statistics`), and vector similarity search (`semantic_property_search`).
- `time-tools/`: OpenClaw tool plugin providing the `get_current_time` tool.
- `scripts/`: Standalone utilities including `semantic_search.py` (handbook-aligned Python vector search script).


## Environment Variables

For `property-db` to query the local/remote MLS MySQL database and generate embeddings, configure the following variables in your environment (see `.env.example`):

- `MYSQL_HOST`: MySQL database host (e.g., `localhost`)
- `MYSQL_USER`: Database username
- `MYSQL_PASSWORD`: Database password (can be empty string)
- `MYSQL_DATABASE`: Target database name (e.g., `idx_exchange`)
- `GEMINI_API_KEY`: Google Gemini API key for free vector embedding generation (`gemini-embedding-001` / `gemini-embedding-2`)
- `OPENAI_API_KEY`: Optional OpenAI API key if preferring `text-embedding-3-small`

## Building and Testing

Inside `property-nlp/`, `property-db/`, or `time-tools/`:

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

- `knowledge/`: Week 8 document RAG sources, index instructions, and end-to-end verification; see [knowledge/README.md](knowledge/README.md).
