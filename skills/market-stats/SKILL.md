---
name: market-stats
description: Market analytics agent skill powered by historical comps (california_sold) and active inventory (rets_property). Answers market timing, price per sq ft, DOM, list-to-close ratios, and 12-month trends for any California city.
metadata:
  openclaw:
    tools:
      - get_market_statistics
      - parse_property_query
      - get_user_session
      - query_property_mls
---

# Market Statistics Skill — Real Estate Analytics Agent

## Purpose
Enables OpenClaw to answer analytical real estate questions using historical comps (`california_sold`) and active MLS inventory (`rets_property`). The agent answers questions such as:
- *"Is now a good time to buy in San Diego?"*
- *"What is the average price per sq ft in Pasadena?"*
- *"How is the housing market in Irvine?"*
- *"What is the 12-month price trend in Sacramento?"*

The agent responds with data-backed summaries including:
- **Median & Average Close Price** (distinguishing true median from luxury skew)
- **Average Price per Square Foot**
- **Average Days on Market (DOM)**
- **List-to-Close Price Ratio** (negotiation leverage indicator)
- **Inventory Comparison** (active listings vs. historical sold volume & months of inventory)
- **12-Month & 24-Month Monthly Price Trends** (Month-over-Month and Year-over-Year changes)
- **Actionable Market Assessment** (clear buyer vs. seller leverage interpretation)

---

## Tool Execution Flow

1. **Extract City & Context**:
   - Parse user's inquiry with `parse_property_query(query)`.
   - If the city is omitted from the question, inspect `get_user_session(userId)` for a previously discussed city.
   - If no city is known, ask: *"Which California city or area are you interested in analyzing?"*

2. **Execute Market Analytics**:
   - Call `get_market_statistics(city, months: 12, includeTrends: true)`.
   - If user asks for longer historical context (e.g., 2 years), pass `months: 24`.
   - If user asks for a specific property type (e.g. condos), pass `propertyType: "Condominium"`.

3. **Synthesize Findings into an Actionable WhatsApp Summary**:
   - Return the structured metrics along with a human-readable interpretation.

---

## Market Metric Interpretation Guide

| Metric | Threshold | Market Meaning | Buyer Guidance |
| :--- | :--- | :--- | :--- |
| **Months of Inventory (MOI)** | `< 3.0 mos`<br>`3.0 – 6.0 mos`<br>`> 6.0 mos` | **Seller's Market** (Supply shortage)<br>**Balanced Market**<br>**Buyer's Market** (Over-supply) | Expect competition; move fast.<br>Fair negotiation conditions.<br>Strong buyer leverage; request concessions. |
| **List-to-Close Ratio** | `> 100.5%`<br>`98.0% – 100.0%`<br>`< 98.0%` | **Bidding Wars** (Selling over ask)<br>**Fair Market** (Close to list price)<br>**Buyer Discounts** (Below asking price) | Sellers hold leverage; prepare clean offers.<br>Standard terms; moderate negotiation room.<br>Buyers hold leverage; offer below list price. |
| **Days on Market (DOM)** | `< 30 days`<br>`30 – 60 days`<br>`> 60 days` | **Rapid Turnover**<br>**Normal Pace**<br>**Stagnant / Cooling Inventory** | Fast decisions necessary.<br>Standard inspection/due diligence windows.<br>Sellers are motivated; opportunity for deals. |
| **12-Month Trend (YoY)** | `Positive (> +3%)`<br>`Flat (-2% to +2%)`<br>`Declining (< -2%)` | **Appreciating**<br>**Stabilized / Plateau**<br>**Softening / Correcting** | Prices climbing; locking in rate/price helps.<br>Stable market with predictable pricing.<br>Waiting or aggressive negotiation can yield bargains. |

---

## Answering Key User Scenarios

### Scenario A: "Is now a good time to buy in [City]?"
- Analyze **Months of Inventory**, **DOM**, and **List-to-Close Ratio**.
- If MOI > 5 months and list-to-close < 98%:
  - *"Yes, buyers currently hold strong negotiation leverage in [City]. Homes are sitting on market an average of X days and closing X% below list price, giving you room to negotiate price and closing credits."*
- If MOI < 2.5 months and list-to-close >= 100%:
  - *"It is currently a competitive seller's market in [City]. Inventory is tight (X months of supply) and homes sell in X days on average. If you are ready to buy, ensure you are pre-approved and prepared to submit strong offers."*

### Scenario B: "What is the average price per sq ft in [City]?"
- Provide both **Avg Price / Sq Ft** and **Median Close Price**, plus the 12-month change to give historical context.

---

## Response Formatting Standards
- Always format for mobile WhatsApp screens:
  - Use bold section headers with emojis (`📊`, `📈`, `💡`).
  - Use clean bullet points for metrics.
  - Never use raw markdown table syntax (which renders poorly on mobile devices).
  - Include the synthesized `💡 Market Assessment` section so numbers are translated into practical real estate advice.
