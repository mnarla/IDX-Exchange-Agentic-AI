export interface SourceDocument {
    title: string;
    location: string;
    content: string;
    url?: string;
}
type Embed = (text: string) => Promise<number[]>;
export interface KnowledgeIndex {
    version: 1;
    model: string;
    createdAt: string;
    chunks: Array<SourceDocument & {
        id: string;
        embedding: number[];
    }>;
}
export declare const defaultIndexPath: string;
export declare function chunkText(text: string, size?: number, overlap?: number): string[];
export declare function buildIndex(docs: SourceDocument[], embed: Embed, model: string, previous?: KnowledgeIndex): Promise<KnowledgeIndex>;
export declare function retrieveKnowledge(query: string, index: KnowledgeIndex, embed: Embed, topK?: number): Promise<{
    query: string;
    matches: {
        id: string;
        content: string;
        citation: string;
        url: string | undefined;
        score: number;
        semantic: number;
        lexical: number;
    }[];
    instruction: string;
}>;
export declare function searchRealEstateKnowledge(args: {
    query: string;
    topK?: number;
}): Promise<{
    query: string;
    matches: {
        id: string;
        content: string;
        citation: string;
        url: string | undefined;
        score: number;
        semantic: number;
        lexical: number;
    }[];
    instruction: string;
} | {
    error: string;
}>;
export {};
