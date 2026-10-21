const sessions = new Map();
export function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, { conversationStep: 0 });
    }
    return sessions.get(userId);
}
export function updateSession(userId, updates) {
    const session = getSession(userId);
    const updated = { ...session, ...updates };
    sessions.set(userId, updated);
    return updated;
}
export function clearSession(userId) {
    sessions.delete(userId);
}
export function getNextFollowUpQuestion(session) {
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
