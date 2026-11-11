---
name: recommendation
description: Recommend similar active California MLS listings from a listing the user likes, with hybrid similarity scores and recent sold-comp price comparisons.
metadata:
  openclaw:
    tools:
      - recommend_properties
      - query_property_mls
---

# Week 7 — Recommendation Engine

Use for requests such as “I like listing ABC123; show me similar homes.”

1. Resolve the liked property's L_ListingID from prior search results. Ask for the listing ID if the reference is ambiguous; never invent one.
2. Call `recommend_properties({listingId: "ABC123", topK: 5})`. Pass explicit user constraints through optional `filters` (city, maxPrice, minBeds, minBaths, minSqft, type, pool, hasView, maxHOA). Do not silently impose same-city or same-type constraints.
3. Present the returned cards in ranked order with similarity score, match reasons, and comp comparison. Scores measure similarity, not purchase probability. Structured fields contribute up to 60 points; embedding cosine similarity contributes up to 40 (negative cosine can lower the total).
4. For available comps, show recent-sales estimated price, asking price delta percentage, and comp count. Positive delta means asking above the estimate; negative means below. State that comps are residential sales in the same city from the past six months within ±20% living area. This is a comparison with recent sales, not an appraisal.
5. For `insufficient_data`, state that no usable estimate is available. Do not replace missing estimates with zero or claim pricing is validated. On tool error, report that the recommendation could not be completed.
6. The engine ranks up to 100 candidates shortlisted by structured similarity and excludes the liked listing and inactive inventory. It returns up to five recommendations; fewer results are possible. Explain the shortlist limit when relevant.

Embedding vectors are generated with the existing configured provider for each request. No separate vector database is required. Calls currently generate embeddings sequentially for the shortlist; larger workloads should precompute embeddings with provider/model metadata.

## Required location and presentation rules

- “Recommend homes similar to listing ABC123 in Glenhaven” restricts the recommended homes to Glenhaven: pass `filters: {city: "Glenhaven"}`. If the user explicitly says “anywhere”, omit the city filter. Never drop explicit constraints, add unrequested bed/price restrictions, or widen the search automatically.
- For example, “Recommend five homes similar to listing 1151238842 in Glenhaven, with scores and comps” requires `recommend_properties({listingId: "1151238842", topK: 5, filters: {city: "Glenhaven"}})`.
- Check `appliedFilters` against the request before presenting results. If a requested filter was omitted, correct the tool call; do not present the unrestricted output as a city-specific search.
- Use the returned `text` as the factual basis of your answer. Preserve every returned `rank`, listing ID, score, city, price, and comp count. Do not reorder the matches or mix results from earlier calls. Do not add features absent from the cards.
- Never explain fewer matches by inventing inventory counts or claiming another city is nearby. A bounded shortlist is not a count of all matching inventory. Report only the returned result count and constraints. Ask before broadening them.
- `insufficient_data` means no usable estimate under the stated comp rules, not that the city has no sales. One or two comps are sparse evidence; do not describe them as strong or solid validation.
- Do not label a recommendation “best value”, “overpriced”, or an investment opportunity from this simple estimate. Report above/below the recent-sales estimate neutrally; similarity ranks are not buying advice.
- Do not offer to schedule viewings, contact agents, or perform other actions without an available tool. Supported follow-ups include changing filters or requesting sold comps.
