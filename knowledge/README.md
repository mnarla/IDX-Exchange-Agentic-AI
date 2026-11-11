# Document knowledge (Week 8)

Sources are extracted page-by-page from the supplied Primer, Trestle metadata, and handbook schema reference (pages 4–6). The existing Week 5 architecture formula is also indexed to disambiguate the project term “list-to-close ratio” from alternate industry naming. This methodology is not a market report. These are local internship documents; do not publish them outside the authorized repository.

```sh
uv run --with pypdf python scripts/extract_knowledge.py ~/Downloads/IDX
(cd property-db && npm run plugin:build && npm run plugin:validate && npm test)
node --env-file=.env scripts/export_market_knowledge.mjs Pasadena # requires MySQL credentials
node --env-file=.env scripts/index_knowledge.mjs
node --env-file=.env scripts/test_knowledge_e2e.mjs
```

Add additional source files as JSON arrays of `{title, location, content, url?}` to `knowledge/sources`. To add Week 5 reports, export actual `get_market_statistics` output with its city, generation date, and data window. No market report values are fabricated. Re-run indexing after changing sources. Unchanged text embeddings are cached; provider/model changes use separate embeddings. Index writes are atomic and rate-limited requests retry. The index is local JSON (linear search, appropriate for this small corpus).

Runtime: build the property-db plugin, allow `search_real_estate_knowledge` in OpenClaw tools, copy `skills/real-estate-knowledge` into the OpenClaw workspace skills folder, and restart an already-running gateway to load updated plugin code. Supply the embedding provider key to the OpenClaw process. Runtime reads the provider/model recorded in the index rather than silently switching providers. `KNOWLEDGE_INDEX_PATH` can override the index location.

Queries use embedding similarity plus exact term matching. Passages preserve title/page and source IDs. The OpenClaw skill requires cited answers and abstention on insufficient evidence. Schema references document selected fields and do not establish a complete live database schema. Tests cover the three questions, empty evidence, chunk boundaries, vector incompatibility, and plugin registration. The end-to-end script uses real embeddings and the configured OpenClaw model, without sending any messages to external recipients.
