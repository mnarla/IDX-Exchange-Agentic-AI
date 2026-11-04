import { query } from "./db.js";
import { formatActiveCard } from "./formatter.js";
let mockEmbeddingFn = null;
/**
 * Configure a mock embedding generator for testing without external OpenAI API calls.
 */
export function setMockEmbeddingFn(fn) {
    mockEmbeddingFn = fn;
}
/**
 * Normalizes text for OpenAI embedding input: replaces newlines with spaces,
 * trims leading/trailing whitespace, and truncates to max 8000 characters for token safety.
 */
export function cleanEmbeddingText(text, maxChars = 8000) {
    if (!text)
        return "";
    return text.replace(/\r?\n+/g, " ").trim().slice(0, maxChars);
}
/**
 * Formats a listing row into the combined text representation specified in the handbook:
 *
 * {L_Type_} in {L_City}, CA.
 * {L_Keyword2} beds, {LM_Dec_3} baths.
 * {LM_Int2_3} sq ft. Built {YearBuilt}.
 * Price: ${L_SystemPrice:,}.
 * {L_Remarks}
 */
export function buildListingEmbeddingText(row) {
    const type = (row.L_Type_ ?? row.type ?? "Property")?.toString().trim() || "Property";
    const city = (row.L_City ?? row.city ?? "")?.toString().trim() || "California";
    const beds = (row.L_Keyword2 ?? row.beds ?? "0")?.toString().trim() || "0";
    const baths = (row.LM_Dec_3 ?? row.baths ?? "0")?.toString().trim() || "0";
    const sqft = (row.LM_Int2_3 ?? row.sqft ?? "0")?.toString().trim() || "0";
    const yearBuilt = (row.YearBuilt ?? row.yearBuilt ?? "Unknown")?.toString().trim() || "Unknown";
    const rawPrice = row.L_SystemPrice ?? row.price ?? 0;
    const numPrice = Number(rawPrice);
    const priceStr = !isNaN(numPrice) && numPrice > 0 ? numPrice.toLocaleString("en-US") : "0";
    const remarks = (row.L_Remarks ?? row.remarks ?? "")?.toString().trim() || "";
    const lines = [
        `${type} in ${city}, CA.`,
        `${beds} beds, ${baths} baths.`,
        `${sqft} sq ft. Built ${yearBuilt}.`,
        `Price: $${priceStr}.`,
    ];
    if (remarks) {
        lines.push(remarks);
    }
    return lines.join("\n").trim();
}
/**
 * Generates a text embedding using Google Gemini (free) or OpenAI, auto-detecting configured keys.
 */
export async function getEmbedding(text, options) {
    const cleaned = cleanEmbeddingText(text);
    if (!cleaned) {
        return [];
    }
    const provider = options?.provider || "auto";
    // Check which keys are available
    const geminiKey = (provider === "gemini" || provider === "auto"
        ? options?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        : null)?.trim();
    const openAiKey = (provider === "openai" || provider === "auto"
        ? options?.apiKey || process.env.OPENAI_API_KEY
        : null)?.trim();
    const activeProvider = provider === "gemini"
        ? "gemini"
        : provider === "openai"
            ? "openai"
            : geminiKey
                ? "gemini"
                : "openai";
    const defaultModel = activeProvider === "gemini" ? "gemini-embedding-001" : "text-embedding-3-small";
    const model = options?.model || defaultModel;
    if (mockEmbeddingFn) {
        return await mockEmbeddingFn(cleaned, model);
    }
    if (activeProvider === "gemini") {
        if (!geminiKey) {
            throw new Error("Missing GEMINI_API_KEY environment variable. Set GEMINI_API_KEY or OPENAI_API_KEY to generate embeddings.");
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${geminiKey}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                content: {
                    parts: [{ text: cleaned }],
                },
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Embedding API error (${response.status}): ${errorText}`);
        }
        const data = (await response.json());
        if (!data?.embedding?.values || !Array.isArray(data.embedding.values)) {
            throw new Error("Invalid response format received from Gemini Embeddings API");
        }
        return data.embedding.values;
    }
    // Fallback to OpenAI
    if (!openAiKey) {
        throw new Error("Missing OPENAI_API_KEY or GEMINI_API_KEY environment variable. Please set GEMINI_API_KEY (free) or OPENAI_API_KEY to generate embeddings.");
    }
    const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
            model,
            input: cleaned,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Embedding API error (${response.status}): ${errorText}`);
    }
    const data = (await response.json());
    if (!data?.data?.[0]?.embedding) {
        throw new Error("Invalid response format received from OpenAI Embeddings API");
    }
    return data.data[0].embedding;
}
/**
 * Computes cosine similarity between two numeric vectors:
 * dot(A, B) / (norm(A) * norm(B))
 *
 * Exactly mirrors sklearn.metrics.pairwise.cosine_similarity.
 */
export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
        return 0;
    }
    const len = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normASq = 0;
    let normBSq = 0;
    for (let i = 0; i < len; i++) {
        const a = vecA[i];
        const b = vecB[i];
        dotProduct += a * b;
        normASq += a * a;
        normBSq += b * b;
    }
    if (normASq === 0 || normBSq === 0) {
        return 0;
    }
    const similarity = dotProduct / (Math.sqrt(normASq) * Math.sqrt(normBSq));
    // Clamp numerical precision boundaries between -1.0 and 1.0
    return Math.max(-1, Math.min(1, similarity));
}
/**
 * Takes a query (as string or embedding vector) and pre-computed listing embeddings,
 * calculates cosine similarity scores, and returns top_k listing IDs sorted descending.
 */
export async function findSimilarListings(queryInput, listingEmbeddings, topK = 5) {
    const safeTopK = Math.max(1, Math.floor(isNaN(topK) ? 5 : topK));
    let queryVec;
    if (Array.isArray(queryInput)) {
        queryVec = queryInput;
    }
    else {
        queryVec = await getEmbedding(queryInput);
    }
    if (queryVec.length === 0 || listingEmbeddings.length === 0) {
        return [];
    }
    const scores = [];
    for (const item of listingEmbeddings) {
        const sim = cosineSimilarity(queryVec, item.embedding);
        scores.push({
            listingId: item.id,
            score: sim,
            row: item.row,
        });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, safeTopK);
}
/**
 * Searches active listings using semantic embedding cosine similarity.
 */
export async function searchSimilarProperties(options) {
    const rawQuery = options.query?.trim();
    if (!rawQuery) {
        return {
            error: "Please provide a search description or query to perform semantic property search.",
        };
    }
    const topK = Math.min(50, Math.max(1, Math.floor(options.topK ?? 5)));
    // Query candidate active listings with non-empty remarks
    const whereClauses = ["L_Status = 'Active'", "L_Remarks IS NOT NULL", "TRIM(L_Remarks) != ''"];
    const params = [];
    if (options.city?.trim()) {
        whereClauses.push("LOWER(L_City) = LOWER(?)");
        params.push(options.city.trim());
    }
    if (options.maxPrice && options.maxPrice > 0) {
        whereClauses.push("L_SystemPrice <= ?");
        params.push(options.maxPrice);
    }
    if (options.minBeds && options.minBeds > 0) {
        whereClauses.push("L_Keyword2 >= ?");
        params.push(options.minBeds);
    }
    if (options.type?.trim()) {
        whereClauses.push("L_Type_ = ?");
        params.push(options.type.trim());
    }
    const sql = `
SELECT
  L_ListingID, L_DisplayId, L_Address, L_City, L_Zip,
  L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths, LM_Int2_3 AS sqft,
  L_Type_ AS type, L_Status AS status,
  LMD_MP_Latitude AS lat, LMD_MP_Longitude AS lng,
  YearBuilt, AssociationFee, DaysOnMarket,
  PoolPrivateYN, ViewYN, FireplaceYN, PhotoCount,
  LA1_UserFirstName, LA1_UserLastName, LO1_OrganizationName,
  L_Remarks
FROM rets_property
WHERE ${whereClauses.join(" AND ")}
ORDER BY L_SystemPrice ASC
LIMIT 100
  `.trim();
    let rows;
    try {
        rows = await query(sql, params);
    }
    catch (err) {
        return {
            error: `Database query failed during semantic search: ${err.message || String(err)}`,
        };
    }
    if (!rows || rows.length === 0) {
        return {
            mode: "semantic",
            query: rawQuery,
            topK,
            resultsCount: 0,
            matches: [],
            text: `No active listings with descriptions found matching criteria${options.city ? ` in ${options.city}` : ""}.`,
        };
    }
    // Generate embedding for user query
    let queryVec;
    try {
        queryVec = await getEmbedding(rawQuery);
    }
    catch (err) {
        return {
            error: `Embedding generation failed: ${err.message || String(err)}`,
        };
    }
    // Generate embeddings for candidate listings
    const listingEmbeddings = [];
    for (const row of rows) {
        const text = buildListingEmbeddingText({
            L_Type_: row.type,
            L_City: row.L_City,
            L_Keyword2: row.beds,
            LM_Dec_3: row.baths,
            LM_Int2_3: row.sqft,
            YearBuilt: row.YearBuilt,
            L_SystemPrice: row.price,
            L_Remarks: row.L_Remarks,
        });
        try {
            const emb = await getEmbedding(text);
            if (emb && emb.length > 0) {
                listingEmbeddings.push({
                    id: row.L_ListingID,
                    embedding: emb,
                    row,
                });
            }
        }
        catch {
            // Continue with other listings if a single embedding fails
        }
    }
    if (listingEmbeddings.length === 0) {
        return {
            mode: "semantic",
            query: rawQuery,
            topK,
            resultsCount: 0,
            matches: [],
            text: "Unable to generate listing embeddings for semantic comparison.",
        };
    }
    // Rank listings using cosine similarity
    const ranked = await findSimilarListings(queryVec, listingEmbeddings, topK);
    const matches = ranked.map((item) => {
        const row = item.row;
        const card = formatActiveCard(row);
        const scorePct = Math.round(Math.max(0, item.score) * 100);
        card.similarityScore = item.score;
        const remarksSnippet = row.L_Remarks
            ? row.L_Remarks.length > 180
                ? `${row.L_Remarks.slice(0, 180).trim()}...`
                : row.L_Remarks
            : null;
        return {
            listingId: item.listingId,
            similarity: item.score,
            scorePct,
            card,
            remarksSnippet,
        };
    });
    const header = `🔍 *Top ${matches.length} Semantic Match${matches.length === 1 ? "" : "es"}* for: _"${rawQuery}"_\n\n`;
    const cardsText = matches
        .map((m, i) => {
        const matchLine = `🎯 *Match Score: ${m.scorePct}%* (${m.similarity.toFixed(3)})`;
        const remarkLine = m.remarksSnippet ? `\n📝 _"${m.remarksSnippet}"_` : "";
        return `[Match ${i + 1}] — ${matchLine}\n${m.card.text}${remarkLine}`;
    })
        .join("\n\n---\n\n");
    const fullText = `${header}${cardsText}`;
    return {
        mode: "semantic",
        query: rawQuery,
        topK,
        resultsCount: matches.length,
        matches,
        text: fullText,
    };
}
