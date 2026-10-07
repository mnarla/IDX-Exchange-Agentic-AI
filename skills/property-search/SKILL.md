---
name: property-search
description: Natural language property search skill that parses user real estate queries into structured filter objects for rets_property queries.
metadata:
  openclaw:
    tools:
      - parse_property_query
---

# Property Search Skill

## Purpose
Enables natural language property searching across active MLS listings (`rets_property`). It converts free-text buyer requests (e.g., "Show me 3-bedroom condos in Irvine under $1.5M with a pool") into structured filter parameters.

## Filter Schema & Column Mapping

The tool returns structured filter parameters with explicit comparison semantics:

| Filter Key | Semantics | `rets_property` Column | Type | Example / Description |
| :--- | :--- | :--- | :--- | :--- |
| **`city`** | Exact / Prefix match | `L_City` | `string \| null` | `"Irvine"`, `"Newport Beach"` |
| **`maxPrice`** | Maximum limit (`<=`) | `L_SystemPrice` | `number \| null` | `1500000` (e.g. from `"$1.5M"`, `"850k"`) |
| **`minBeds`** | Minimum threshold (`>=`)| `L_Keyword2` | `number \| null` | `3` (e.g. from `"3 bed"`, `"3+ beds"`, `"three bedroom"`) |
| **`minBaths`** | Minimum threshold (`>=`)| `LM_Dec_3` | `number \| null` | `2.5` (e.g. from `"2.5 bath"`, `"two and a half baths"`) |
| **`minSqft`** | Minimum threshold (`>=`)| `LM_Int2_3` | `number \| null` | `2500` (e.g. from `"at least 2500 sq ft"`, `"2500+ sqft"`) |
| **`type`** | Exact match | `L_Type_` | `string \| null` | `"Condominium"`, `"SingleFamilyResidence"`, `"Townhouse"`, `"UnimprovedLand"` |
| **`pool`** | Flag | `PoolPrivateYN` | `"True" \| null` | `"True"` if private pool requested |
| **`hasView`** | Flag | `ViewYN` | `"True" \| null` | `"True"` if view requested |
| **`maxHOA`** | Maximum limit (`<=`) | `AssociationFee` | `number \| null` | `400` (parsed before price to avoid number collisions) |

## Tool & Query Rules
1. **Invocation**: For any user query expressing real estate search criteria, invoke `parse_property_query(query: string)`.
2. **Missing & Default Values**: Unmentioned criteria evaluate strictly to `null`. Downstream query generators in Week 3 omit `WHERE` clauses for `null` keys.
3. **Clarifications**:
   - If `city` is `null` and no location context exists in session memory, prompt the user for their desired city or county.
   - If non-real-estate input is received, all filters return `null`, allowing graceful fallbacks.
