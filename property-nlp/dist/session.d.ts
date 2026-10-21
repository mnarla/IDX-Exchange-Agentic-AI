export interface UserSession {
    city?: string;
    maxPrice?: number;
    beds?: number;
    baths?: number;
    type?: string;
    pool?: string;
    lastResults?: Array<Record<string, unknown>>;
    conversationStep: number;
}
export declare function getSession(userId: string): UserSession;
export declare function updateSession(userId: string, updates: Partial<UserSession>): UserSession;
export declare function clearSession(userId: string): void;
export declare function getNextFollowUpQuestion(session: UserSession): string | null;
