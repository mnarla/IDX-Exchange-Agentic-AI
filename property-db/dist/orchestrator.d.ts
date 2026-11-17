export type AgentIntent = "search" | "market" | "recommend" | "knowledge" | "email" | "mixed" | "unknown";
export interface OrchestratorResult {
    intent: AgentIntent;
    response: string;
    text: string;
    mode?: string;
    data?: unknown;
    listings?: unknown;
    stats?: unknown;
    error?: string;
    [key: string]: unknown;
}
/**
 * Classifies an incoming real estate query into one of the specialized agent intents,
 * or "mixed" when multiple sub-agents are needed concurrently.
 */
export declare function classifyIntent(query: string): Promise<AgentIntent>;
/**
 * 1. propertySearchAgent — queries rets_property with structured filters and maintains session memory.
 */
export declare function propertySearchAgent(query: string, userId: string): Promise<OrchestratorResult>;
/**
 * 2. marketStatsAgent — aggregates california_sold for trends, comps, and climate.
 */
export declare function marketStatsAgent(query: string, city?: string): Promise<OrchestratorResult>;
/**
 * 3. recommendationAgent — surfaces similar listings with comp validation.
 */
export declare function recommendationAgent(target?: string | Record<string, unknown> | null, query?: string): Promise<OrchestratorResult>;
/**
 * 4. ragAgent — answers conceptual and definitional questions.
 */
export declare function ragAgent(query: string): Promise<OrchestratorResult>;
/**
 * 5. emailDraftAgent — composes formatted property or market summaries.
 */
export declare function emailDraftAgent(query: string, userId?: string): Promise<OrchestratorResult>;
/**
 * Combines listings and market statistics into a unified response.
 */
export declare function formatCombinedResponse(listings: any, stats: any): OrchestratorResult;
/**
 * Main coordinator function following the Week 9 Multi-Agent Orchestration logic.
 */
export declare function orchestrate(query: string, userId?: string): Promise<OrchestratorResult>;
