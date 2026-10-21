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

const sessions = new Map<string, UserSession>();

export function getSession(userId: string): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, { conversationStep: 0 });
  }
  return sessions.get(userId)!;
}

export function updateSession(userId: string, updates: Partial<UserSession>): UserSession {
  const session = getSession(userId);
  const updated = { ...session, ...updates };
  sessions.set(userId, updated);
  return updated;
}

export function clearSession(userId: string): void {
  sessions.delete(userId);
}

export function getNextFollowUpQuestion(session: UserSession): string | null {
  if (!session.city) {
    return "Which city or area are you looking to buy in?";
  }
  if (session.maxPrice === undefined || session.maxPrice === null) {
    return "What is your budget?";
  }
  if (session.conversationStep <= 2 && (!session.type || (session.type === "SingleFamilyResidence" && !session.beds))) {
    return "Any preferences — condo, townhome, or single family?";
  }
  if (!session.type) {
    return "Any preferences — condo, townhome, or single family?";
  }
  return null;
}
