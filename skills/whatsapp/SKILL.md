---
name: whatsapp
description: WhatsApp communication layer that handles incoming real estate messages in real time with typing indicator presence, invokes multi-agent orchestration, and returns standardized WhatsApp property cards.
metadata:
  openclaw:
    tools:
      - on_whatsapp_message
      - orchestrate
      - query_property_mls
      - get_market_statistics
      - recommend_properties
      - search_real_estate_knowledge
---

# WhatsApp Communication Layer (Week 10)

## Purpose
Wires the multi-agent orchestrator directly to WhatsApp as the primary user-facing communication interface. Users interact entirely through WhatsApp — searching for homes, asking market questions, and receiving clean, formatted property summaries.

## Core Flow
```
WhatsApp Inbound Message
       ↓
sendTypingIndicator(userId)
       ↓
orchestrate(message, userId)
       ↓
formatForWhatsApp(result)
       ↓
WhatsApp Outbound Reply
```

## Formatted Card Layout
Listings are formatted to the handbook's standardized WhatsApp template:
```text
🏠 *430 N Holliston 210, Pasadena*
💰 $450,000 | 🛏 2bd/2ba | 📐 855 sqft
📅 55 days on market
```
