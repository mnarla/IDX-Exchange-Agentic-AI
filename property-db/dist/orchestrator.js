import { searchActiveListings } from "./active.js";
import { getMarketStatistics } from "./market.js";
import { recommendProperties } from "./recommendation.js";
import { searchRealEstateKnowledge } from "./knowledge.js";
import { parsePropertyQuery, getSession, updateSession, } from "openclaw-plugin-property-nlp";
/**
 * Classifies an incoming real estate query into one of the specialized agent intents,
 * or "mixed" when multiple sub-agents are needed concurrently.
 */
export async function classifyIntent(query) {
    if (!query || typeof query !== "string" || !query.trim()) {
        return "unknown";
    }
    const text = query.trim().toLowerCase();
    // 1. Email drafting intent
    const isEmail = /\b(?:draft|compose|write|send)\s+(?:an?\s+)?(?:email|summary\s+email)\b/i.test(text) ||
        /\bemail\s+(?:to|for)\s+[a-z]+/i.test(text);
    // 2. Knowledge / Conceptual / RAG intent
    const isKnowledge = /\b(?:what\s+is|what\s+are|define|definition\s+of|meaning\s+of|explain)\s+(?:dom|days\s+on\s+market|escrow|earnest\s+money|comps?|contingenc(?:y|ies)|list-to-close|reso)\b/i.test(text) ||
        /\b(?:schema|table\s+columns?|columns?\s+(?:in|exist|are\s+in))\s+(?:rets_property|california_sold)\b/i.test(text) ||
        /\bhow\s+does\s+(?:escrow|earnest\s+money|due\s+diligence)\s+work\b/i.test(text);
    // 3. Recommendation intent
    const isRecommend = /\b(?:recommend|similar|more\s+like|comparable)\s+(?:to|homes?|properties|listings?|houses?)\b/i.test(text) ||
        /\b(?:like\s+listing|similar\s+to\s+listing)\b/i.test(text) ||
        /\bmore\s+homes\s+like\s+this\b/i.test(text);
    // 4. Market Analytics signals
    const hasMarket = /\b(?:market|trends?|prices?\s+(?:are\s+)?(?:rising|falling|dropping|up|down)|appreciation|median\s+price|average\s+price|price\s+per\s+sq\s*ft|price\/sqft|dom|days\s+on\s+market|inventory|buyer's\s+market|seller's\s+market|good\s+time\s+to\s+buy)\b/i.test(text);
    // 5. Property Search signals (strip market phrases first so "home prices" doesn't falsely trigger search)
    const textWithoutMarket = text
        .replace(/\bgood\s+time\s+to\s+(?:buy|sell)\b/gi, " ")
        .replace(/\b(?:home|housing|property)\s+(?:prices?|values?|market|trends?)\b/gi, " ")
        .replace(/\bprices?\s+(?:are\s+)?(?:rising|falling|dropping|up|down)\b/gi, " ");
    const hasSearch = /\b(?:find|search|show|look\s+for|looking\s+for|buy|buying)\b/i.test(textWithoutMarket) ||
        /\b(?:homes?|houses?|condos?|condominiums?|townhomes?|properties|units?|single\s+family)\b/i.test(textWithoutMarket) ||
        /\b(?:\d+\s*(?:bed|beds|bedroom|bath|baths|bathroom)|under\s+\$|\$\d+|pool|view)\b/i.test(textWithoutMarket);
    // Mixed intent: Both Search and Market signals present
    if (hasSearch && hasMarket) {
        return "mixed";
    }
    // Prioritize specific intents
    if (isEmail)
        return "email";
    if (isKnowledge)
        return "knowledge";
    if (isRecommend)
        return "recommend";
    if (hasMarket)
        return "market";
    if (hasSearch)
        return "search";
    return "unknown";
}
/**
 * 1. propertySearchAgent — queries rets_property with structured filters and maintains session memory.
 */
export async function propertySearchAgent(query, userId) {
    const parsed = await parsePropertyQuery(query);
    const session = getSession(userId);
    const updates = {
        conversationStep: (session.conversationStep || 0) + 1,
    };
    if (parsed.city)
        updates.city = parsed.city;
    if (parsed.maxPrice !== null)
        updates.maxPrice = parsed.maxPrice;
    if (parsed.minBeds !== null)
        updates.beds = parsed.minBeds;
    if (parsed.minBaths !== null)
        updates.baths = parsed.minBaths;
    if (parsed.type)
        updates.type = parsed.type;
    if (parsed.pool)
        updates.pool = parsed.pool;
    const updatedSession = updateSession(userId, updates);
    const filters = {
        city: updatedSession.city || null,
        maxPrice: updatedSession.maxPrice ?? null,
        minBeds: updatedSession.beds ?? null,
        minBaths: updatedSession.baths ?? null,
        type: updatedSession.type ?? null,
        pool: updatedSession.pool ?? null,
    };
    const results = await searchActiveListings(filters, 1, 10);
    // Store lastResults in session for downstream recommendation or email drafting agents
    if (results.cards && results.cards.length > 0) {
        const rawListings = results.cards.map((c) => ({
            L_ListingID: c.listingId,
            listingId: c.listingId,
            L_City: c.city,
            L_Address: c.address,
            price: c.price,
            beds: c.beds,
            baths: c.baths,
            sqft: c.sqft,
            type: c.propertyType,
            text: c.text,
        }));
        updateSession(userId, { lastResults: rawListings });
    }
    return {
        intent: "search",
        mode: "search",
        response: results.text,
        text: results.text,
        filters,
        results,
        cards: results.cards,
        listings: results.cards,
    };
}
/**
 * Helper to extract city name from free-text query.
 */
function extractCityFromText(query) {
    const match = query.match(/\b(?:in|for|at|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i);
    return match ? match[1].trim() : null;
}
/**
 * 2. marketStatsAgent — aggregates california_sold for trends, comps, and climate.
 */
export async function marketStatsAgent(query, city) {
    let targetCity = city?.trim();
    if (!targetCity) {
        const parsed = await parsePropertyQuery(query);
        targetCity = parsed.city || extractCityFromText(query) || "Pasadena";
    }
    const statsResult = await getMarketStatistics({ city: targetCity, months: 12 });
    if ("error" in statsResult) {
        return {
            intent: "market",
            mode: "market",
            city: targetCity,
            error: statsResult.error,
            response: statsResult.error,
            text: statsResult.error,
        };
    }
    return {
        intent: "market",
        mode: "market",
        city: targetCity,
        response: statsResult.text,
        text: statsResult.text,
        stats: statsResult,
    };
}
/**
 * 3. recommendationAgent — surfaces similar listings with comp validation.
 */
export async function recommendationAgent(target, query) {
    let listingId = null;
    if (typeof target === "string" && target.trim()) {
        listingId = target.trim();
    }
    else if (target && typeof target === "object") {
        listingId =
            target.L_ListingID ||
                target.listingId ||
                null;
    }
    // If not provided in target object/string, attempt to parse listing ID from query
    if (!listingId && query) {
        const match = query.match(/\b\d{7,12}\b/);
        if (match) {
            listingId = match[0];
        }
    }
    if (!listingId) {
        const fallbackMsg = "I couldn't find a listing in your session to base recommendations on. Try searching for properties first or provide a specific listing ID.";
        return {
            intent: "recommend",
            mode: "recommendation",
            error: fallbackMsg,
            response: fallbackMsg,
            text: fallbackMsg,
        };
    }
    // Check if query restricts to a specific city or filter
    let filters;
    if (query) {
        const parsed = await parsePropertyQuery(query);
        if (parsed.city || parsed.maxPrice) {
            filters = {};
            if (parsed.city)
                filters.city = parsed.city;
            if (parsed.maxPrice)
                filters.maxPrice = parsed.maxPrice;
        }
    }
    const recResult = await recommendProperties({ listingId, topK: 5, filters });
    const textOutput = recResult.text || recResult.error || "";
    return {
        intent: "recommend",
        mode: "recommendation",
        listingId,
        response: textOutput,
        text: textOutput,
        ...recResult,
    };
}
/**
 * 4. ragAgent — answers conceptual and definitional questions.
 */
export async function ragAgent(query) {
    const result = await searchRealEstateKnowledge({ query, topK: 4 });
    if ("error" in result) {
        return {
            intent: "knowledge",
            mode: "knowledge",
            query,
            error: result.error,
            response: result.error,
            text: result.error,
        };
    }
    let formattedText = "";
    if (result.matches && result.matches.length > 0) {
        const passageTexts = result.matches
            .map((m, i) => `[Source ${m.id}] ${m.citation}:\n${m.content.trim()}`)
            .join("\n\n---\n\n");
        formattedText = `📚 Grounded Real Estate Knowledge:\n\n${passageTexts}\n\n_${result.instruction}_`;
    }
    else {
        formattedText = result.instruction || "No supporting knowledge passages found for your query.";
    }
    return {
        intent: "knowledge",
        mode: "knowledge",
        query,
        result,
        response: formattedText,
        text: formattedText,
    };
}
/**
 * 5. emailDraftAgent — composes formatted property or market summaries.
 */
export async function emailDraftAgent(query, userId = "default_user") {
    const session = getSession(userId);
    // Extract client name if specified in query (e.g. "email for John", "draft to Sarah", "email for client Alice")
    const recipientMatch = query.match(/\b(?:to|for)(?:\s+client)?\s+([A-Z][a-z]+)\b/i);
    const recipient = recipientMatch ? recipientMatch[1] : "Valued Client";
    // Check target city
    const parsed = await parsePropertyQuery(query);
    const targetCity = parsed.city || session.city || "Pasadena";
    // Subject line
    const subject = `Real Estate Market Update & Selected Listings — ${targetCity}`;
    let body = `Dear ${recipient},\n\n`;
    body += `Here is your customized real estate update for ${targetCity}:\n\n`;
    // Include recent listings if available in session
    if (session.lastResults && session.lastResults.length > 0) {
        body += `🏡 Featured Properties:\n`;
        session.lastResults.slice(0, 3).forEach((item, idx) => {
            const priceStr = item.price ? `$${Number(item.price).toLocaleString("en-US")}` : "Contact for Price";
            const specs = [
                item.beds ? `${item.beds} Beds` : null,
                item.baths ? `${item.baths} Baths` : null,
                item.sqft ? `${Number(item.sqft).toLocaleString("en-US")} SqFt` : null,
            ]
                .filter(Boolean)
                .join(" • ");
            body += `${idx + 1}. ${item.L_Address || item.address || "Listing"} (${item.L_City || item.city || targetCity})\n`;
            body += `   Price: ${priceStr}${specs ? ` | ${specs}` : ""}\n`;
        });
        body += `\n`;
    }
    body += `Please let me know if you would like to schedule a private showing or review recent comparable sales.\n\n`;
    body += `Best regards,\nYour Real Estate Advisory Team`;
    const fullText = `📧 Drafted Email:\n\n**Subject:** ${subject}\n\n${body}`;
    return {
        intent: "email",
        mode: "email",
        subject,
        recipient,
        body,
        response: fullText,
        text: fullText,
    };
}
/**
 * Combines listings and market statistics into a unified response.
 */
export function formatCombinedResponse(listings, stats) {
    const statsText = stats?.text || stats?.response || "Market statistics unavailable.";
    const listingsText = listings?.text || listings?.response || "No active listings found.";
    const combinedText = `📊 Market Trends & Climate Analysis:\n${statsText}\n\n==============================\n\n🏡 Matching Active Properties:\n${listingsText}`;
    return {
        intent: "mixed",
        mode: "mixed",
        response: combinedText,
        text: combinedText,
        listings,
        stats,
    };
}
/**
 * Main coordinator function following the Week 9 Multi-Agent Orchestration logic.
 */
export async function orchestrate(query, userId = "default_user") {
    const intent = await classifyIntent(query);
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
                intent: "unknown",
                response: "I'm not sure how to help with that. Try asking about properties or market trends.",
                text: "I'm not sure how to help with that. Try asking about properties or market trends.",
            };
    }
}
