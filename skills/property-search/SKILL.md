---
name: property-search
description: Real estate search skill that parses natural language buyer queries and queries active MLS listings (rets_property) and sold comps (california_sold).
metadata:
  openclaw:
    tools:
      - parse_property_query
      - query_property_mls
---

# Property Search Skill

## Purpose
Enables end-to-end natural language property searching and historical comps analysis. It converts free-text buyer requests (e.g., "Show me 3-bedroom condos in Irvine under $1.5M with a pool") into structured filter parameters and queries the MLS relational database tables (`rets_property` and `california_sold`), returning structured objects and WhatsApp-friendly property cards.

## Filter Schema & Column Mapping

The natural language parser (`parse_property_query`) extracts structured filter parameters with explicit comparison semantics for the database layer (`query_property_mls`):

| Filter Key | Semantics | `rets_property` Column | Type | Example / Description |
| :--- | :--- | :--- | :--- | :--- |
| **`city`** | Exact match | `L_City` | `string \| null` | `"Irvine"`, `"Newport Beach"` |
| **`maxPrice`** | Maximum limit (`<=`) | `L_SystemPrice` | `number \| null` | `1500000` (e.g. from `"$1.5M"`, `"850k"`) |
| **`minBeds`** | Minimum threshold (`>=`)| `L_Keyword2` | `number \| null` | `3` (e.g. from `"3 bed"`, `"3+ beds"`, `"three bedroom"`) |
| **`minBaths`** | Minimum threshold (`>=`)| `LM_Dec_3` | `number \| null` | `2.5` (e.g. from `"2.5 bath"`, `"two and a half baths"`) |
| **`minSqft`** | Minimum threshold (`>=`)| `LM_Int2_3` | `number \| null` | `2500` (e.g. from `"at least 2500 sq ft"`, `"2500+ sqft"`) |
| **`type`** | Exact match | `L_Type_` | `string \| null` | `"Condominium"`, `"SingleFamilyResidence"`, `"Townhouse"`, `"UnimprovedLand"` |
| **`pool`** | Flag (`'1'` in DB) | `PoolPrivateYN` | `"True" \| null` | `"True"` if private pool requested |
| **`hasView`** | Flag (`'1'` in DB) | `ViewYN` | `"True" \| null` | `"True"` if view requested |
| **`maxHOA`** | Maximum limit (`<=`) | `AssociationFee` | `number \| null` | `400` (parsed before price to avoid number collisions) |

## Tool & Query Rules

1. **Query Workflow**:
   - For any user query expressing real estate search criteria, first invoke `parse_property_query(query: string)`.
   - Pass the resulting structured `PropertyFilter` object directly to `query_property_mls(filters, mode, page, limit, months)`.

2. **Query Modes (`query_property_mls`)**:
   - `mode = "active"`: Queries active listings in `rets_property` (`WHERE L_Status = 'Active'`). Ordered by price ascending. Supports pagination with `page` (default 1) and `limit` (default 10, max 50).
   - `mode = "sold"`: Queries historical closed transactions in `california_sold` for the requested city within the past `months` (default 12).
   - `mode = "both"`: Queries both active listings and recent sold comps for the same city simultaneously.

3. **Validation & Missing Values**:
   - **City requirement**: When calling in `"sold"` or `"both"` mode, `city` is **mandatory**. If `city` is missing or null, do not query the database; prompt the user for their desired city first.
   - **Missing & Default Filter Keys**: Unmentioned filter criteria evaluate to `null`. The query generator automatically omits `WHERE` clauses for `null` keys.
   - Non-real-estate queries: All filter fields return `null`, allowing graceful fallbacks.

4. **Card Output**:
   - `query_property_mls` returns both structured JSON properties and pre-rendered plain text / WhatsApp markdown cards (avoiding markdown tables for mobile readability).
