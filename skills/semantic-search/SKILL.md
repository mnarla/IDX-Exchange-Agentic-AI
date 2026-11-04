---
name: semantic-search
description: Semantic property search skill powered by OpenAI vector embeddings and cosine similarity. Matches free-text descriptions, aesthetic preferences, architectural styles, and lifestyle vibes with active MLS listings (rets_property).
metadata:
  openclaw:
    tools:
      - semantic_property_search
      - query_property_mls
      - parse_property_query
      - get_user_session
      - update_user_session
---

# Semantic Property Search Skill — Vector & Embedding Search Agent

## Purpose
Enables semantic real estate discovery across California active MLS inventory (`rets_property`) using OpenAI vector embeddings (`text-embedding-3-small`) and cosine similarity.

While traditional SQL filters match exact structured fields (`beds = 3`, `city = 'Pasadena'`), semantic search captures descriptive, subjective, stylistic, and lifestyle nuances stored inside listing remarks (`rets_property.L_Remarks`), including:
- *"Charming craftsman with mountain views and character"*
- *"Mid-century modern home with floor-to-ceiling glass and natural light"*
- *"Peaceful coastal sanctuary with open concept kitchen and entertainer's yard"*
- *"Rustic mountain retreat with exposed timber beams and stone fireplace"*
- *"Sleek industrial loft with high ceilings near art district"*

The agent returns the **top 5 most semantically similar active listings** scored by cosine similarity, complete with match score percentages and highlighted description excerpts.

---

## When to Use Semantic Search vs. SQL Search

| User Query Style | Example | Best Skill / Tool |
| :--- | :--- | :--- |
| **Strict Numeric / Relational** | *"Find 3 bed 2 bath condos in Irvine under $900k"* | `property-search` (`query_property_mls`) |
| **Stylistic / Architectural** | *"Charming craftsman bungalow with character"* | `semantic-search` (`semantic_property_search`) |
| **Aesthetic & Vibe** | *"Mid-century modern with tons of natural light and zen garden"* | `semantic-search` (`semantic_property_search`) |
| **Lifestyle & Amenities** | *"Entertainer's dream home with panoramic sunset views"* | `semantic-search` (`semantic_property_search`) |
| **Hybrid (Criteria + Vibe)** | *"Modern loft in Downtown LA under $1M with high ceilings"* | `semantic-search` with `city` / `maxPrice` filters |

---

## Listing Embedding Document Construction

Each listing's embedding vector is generated from combined structured fields and listing remarks:

```text
{L_Type_} in {L_City}, CA.
{L_Keyword2} beds, {LM_Dec_3} baths.
{LM_Int2_3} sq ft. Built {YearBuilt}.
Price: ${L_SystemPrice:,}.
{L_Remarks}
```

- Newlines are normalized to spaces for token safety.
- Input is safely truncated to 8,000 characters.
- OpenAI model: `text-embedding-3-small` (1536-dimensional float vector).

---

## Similarity Metric & Ranking

Cosine similarity measures the angular cosine distance between the user query vector $\vec{q}$ and listing vector $\vec{d}$:

$$\text{Similarity}(\vec{q}, \vec{d}) = \frac{\vec{q} \cdot \vec{d}}{\|\vec{q}\|_2 \|\vec{d}\|_2}$$

- **Range**: $[-1.0, 1.0]$ (clamped).
- **Match Percentage**: $\text{scorePct} = \text{round}(\max(0, \text{sim}) \times 100)\%$.
- Listings are sorted in descending order, returning the top 5 matches.

---

## Tool Execution Flow

1. **Extract Search Intent & Free-Text Description**:
   - Identify the user's qualitative or aesthetic request.
   - If the query also mentions a location (e.g., *"in Pasadena"*), extract the city using `parse_property_query`.
   - If city was previously established in `get_user_session(userId)`, inherit it as an optional restriction.

2. **Execute Semantic Search**:
   - Call `semantic_property_search`:
     ```typescript
     await semantic_property_search({
       query: "charming craftsman with mountain views and character",
       topK: 5,
       city: "Pasadena" // optional
     });
     ```

3. **Present Top 5 Results over WhatsApp**:
   - Present results using clean WhatsApp markdown cards with:
     - **Match Score**: `🎯 *Match Score: 94%*`
     - **Price**: bold currency format (e.g., `*$1,450,000*`)
     - **Specs**: Beds • Baths • SqFt
     - **Location**: 📍 Address, City, Zip
     - **Key Remarks Snippet**: Highlight the excerpt that matched their search
     - **Photo Count**: `📷 Photos: <count>`
     - **Listing ID**: `🆔 Listing ID: <id>`

