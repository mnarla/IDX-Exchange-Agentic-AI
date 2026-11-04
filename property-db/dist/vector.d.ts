import type { ActiveListingRow, ListingEmbeddingRow, SemanticSearchResult, SemanticSearchOptions } from "./types.js";
export type EmbeddingFn = (text: string, model: string) => Promise<number[]>;
/**
 * Configure a mock embedding generator for testing without external OpenAI API calls.
 */
export declare function setMockEmbeddingFn(fn: EmbeddingFn | null): void;
/**
 * Normalizes text for OpenAI embedding input: replaces newlines with spaces,
 * trims leading/trailing whitespace, and truncates to max 8000 characters for token safety.
 */
export declare function cleanEmbeddingText(text: string, maxChars?: number): string;
/**
 * Formats a listing row into the combined text representation specified in the handbook:
 *
 * {L_Type_} in {L_City}, CA.
 * {L_Keyword2} beds, {LM_Dec_3} baths.
 * {LM_Int2_3} sq ft. Built {YearBuilt}.
 * Price: ${L_SystemPrice:,}.
 * {L_Remarks}
 */
export declare function buildListingEmbeddingText(row: ListingEmbeddingRow): string;
/**
 * Generates a text embedding using Google Gemini (free) or OpenAI, auto-detecting configured keys.
 */
export declare function getEmbedding(text: string, options?: {
    apiKey?: string;
    model?: string;
    provider?: "gemini" | "openai" | "auto";
}): Promise<number[]>;
/**
 * Computes cosine similarity between two numeric vectors:
 * dot(A, B) / (norm(A) * norm(B))
 *
 * Exactly mirrors sklearn.metrics.pairwise.cosine_similarity.
 */
export declare function cosineSimilarity(vecA: number[], vecB: number[]): number;
export interface ListingEmbeddingItem {
    id: string;
    embedding: number[];
    row?: ActiveListingRow;
}
/**
 * Takes a query (as string or embedding vector) and pre-computed listing embeddings,
 * calculates cosine similarity scores, and returns top_k listing IDs sorted descending.
 */
export declare function findSimilarListings(queryInput: string | number[], listingEmbeddings: ListingEmbeddingItem[], topK?: number): Promise<Array<{
    listingId: string;
    score: number;
    row?: ActiveListingRow;
}>>;
/**
 * Searches active listings using semantic embedding cosine similarity.
 */
export declare function searchSimilarProperties(options: SemanticSearchOptions): Promise<SemanticSearchResult | {
    error: string;
}>;
