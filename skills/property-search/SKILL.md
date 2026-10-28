---
name: property-search
description: Conversational real estate search skill that maintains multi-turn session memory, asks follow-up clarifying questions, refines queries iteratively, and queries active MLS listings (rets_property) and sold comps (california_sold).
metadata:
  openclaw:
    tools:
      - parse_property_query
      - get_user_session
      - update_user_session
      - clear_user_session
      - query_property_mls
      - get_market_statistics
---


# Property Search Skill — Conversational Property Search Agent

## Purpose
Enables a multi-turn conversational real estate search experience. The agent remembers search preferences across conversation turns within a user session, asks targeted follow-up clarifying questions when search parameters are missing, progressively refines queries iteratively, and returns matching listings from the MLS relational database tables (`rets_property` and `california_sold`) with formatted property cards including photo counts.

## Session Memory Schema (`UserSession`)

Session memory tracks the active buyer profile across turns:

```typescript
interface UserSession {
  city?: string;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  type?: string;
  pool?: string;
  lastResults?: ListingRow[];
  conversationStep: number;
}
```

- **`getSession(userId)`**: Fetches or initializes a session for the WhatsApp user (defaults `conversationStep: 0`).
- **`updateSession(userId, updates)`**: Merges newly parsed criteria with existing preferences without overwriting unmentioned fields.
- **`clearSession(userId)`**: Resets session memory when the user wants to start over (e.g., "reset", "start new search").

## Multi-Turn Conversational Lifecycle

The agent progressively builds the search query through natural conversation:

1. **Turn 1 — Initial Intent & Location**:
   - User expresses search intent (e.g., *"Find homes in Irvine"*).
   - Agent parses criteria via `parse_property_query` and updates session (`city: "Irvine"`, `conversationStep: 1`).
   - If budget is missing, agent asks: *"What is your budget?"*

2. **Turn 2 — Budget Clarification**:
   - User answers with budget (e.g., *"Under $1.2M"*).
   - Agent extracts price and updates session (`maxPrice: 1200000`, `conversationStep: 2`).
   - If property type / beds are missing, agent asks: *"Any preferences — condo, townhome, or single family?"*

3. **Turn 3 — Property Type & Criteria Refinement**:
   - User responds with preferences (e.g., *"Single family with at least 3 beds"*).
   - Agent updates session (`type: "SingleFamilyResidence"`, `beds: 3`, `conversationStep: 3`).
   - Once core criteria (city, budget, type/beds) are collected, or when the user requests listings, execute the query immediately.

4. **Iterative Refinements**:
   - User can refine further at any time (e.g., *"With a private pool"*, *"Must have 2+ baths"*).
   - The agent retains existing criteria (`city`, `maxPrice`, `beds`) and applies the refinement.

## Tool & Query Rules

1. **Session-Aware Execution**:
   - Extract newly mentioned filters with `parse_property_query(query)`.
   - Update user session state via `update_user_session(userId, updates)`.
   - If key parameters are still needed to avoid returning an overly broad search:
     - Ask the targeted follow-up question.
   - When criteria are sufficient or user asks for listings:
     - Call `query_property_mls(filters: accumulatedSessionFilters, mode: "active")`.
     - Save returned cards to `lastResults` in the session.
     - Present the listings cleanly formatted.

2. **Listing Output Deliverable**:
   - Present results using clean WhatsApp markdown cards with:
     - **Address** (📍 `L_Address, L_City, L_Zip`)
     - **Price** (bold currency format: `*$1,150,000*`)
     - **Beds / Baths / SqFt** (`3 Beds • 2 Baths • 1,850 SqFt`)
     - **Photo Count** (📷 `Photos: N`)
     - **Amenities** (🏊 Private Pool, 🌅 Scenic View, etc.)
   - Do NOT use markdown tables; use mobile-friendly bulleted property cards.

3. **Resetting Session**:
   - If the user says *"start over"*, *"reset"*, or *"new search"*, call `clear_user_session(userId)` and acknowledge that search preferences have been reset.

