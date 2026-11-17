---
name: orchestrator
description: Combine all specialized real estate agents into a single intelligent coordinator. Analyzes each incoming query and routes it — or splits it across multiple agents in parallel — to produce a comprehensive, unified response.
metadata:
  openclaw:
    tools:
      - orchestrate
      - query_property_mls
      - get_market_statistics
      - recommend_properties
      - search_real_estate_knowledge
      - parse_property_query
      - get_user_session
      - update_user_session
      - clear_user_session
---

# Multi-Agent Orchestrator (Week 9)

## Purpose
Coordinates the full agent registry across five specialized capabilities:
1. **`propertySearchAgent`** — queries active MLS listings (`rets_property`) with structured filters and maintains session state.
2. **`marketStatsAgent`** — aggregates closed comps (`california_sold`) for pricing trends, DOM, and market climate.
3. **`recommendationAgent`** — surfaces similar listings from a liked listing with sold-comp price validation.
4. **`ragAgent`** — answers conceptual and definitional questions using grounded documentation.
5. **`emailDraftAgent`** — composes professional property or market update summaries.

## Core Coordinator Logic

Incoming user messages are processed through `orchestrate(query, userId)`:

```typescript
export async function orchestrate(query: string, userId: string) {
  const intent = await classifyIntent(query);
  // intent: "search" | "market" | "recommend" | "knowledge" | "email" | "mixed"

  switch (intent) {
    case "search":
      return await propertySearchAgent(query, userId);

    case "market":
      return await marketStatsAgent(query);

    case "recommend": {
      const session = getSession(userId);
      return await recommendationAgent(session.lastResults?.[0], query);
    }

    case "knowledge":
      return await ragAgent(query);

    case "email":
      return await emailDraftAgent(query, userId);

    case "mixed": {
      const [listings, stats] = await Promise.all([
        propertySearchAgent(query, userId),
        marketStatsAgent(query),
      ]);
      return formatCombinedResponse(listings, stats);
    }

    default:
      return {
        response: "I'm not sure how to help with that. Try asking about properties or market trends.",
      };
  }
}
```

## Mixed-Intent Handling
For compound queries that span both property discovery and analytical questions (e.g., *"Find me affordable homes in Pasadena and tell me whether prices are rising"*), the orchestrator triggers `propertySearchAgent` and `marketStatsAgent` concurrently via `Promise.all` and merges the results into a combined report with market climate analysis and matching active cards.
