import { type OrchestratorResult } from "./orchestrator.js";
export interface WhatsAppListingItem {
    L_Address?: string | null;
    L_City?: string | null;
    address?: string | null;
    city?: string | null;
    price?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    DaysOnMarket?: number | null;
    daysOnMarket?: number | null;
    [key: string]: unknown;
}
export declare function setCustomTypingHandler(fn: ((userId: string) => Promise<void>) | null): void;
export declare function sendTypingIndicator(userId: string): Promise<void>;
/**
 * Formats an OrchestratorResult specifically for WhatsApp according to the Week 10 handbook specification:
 *
 * 🏠 *Address, City*
 * 💰 $Price | 🛏 Xbd/Yba | 📐 Z sqft
 * 📅 N days on market
 */
export declare function formatForWhatsApp(result: OrchestratorResult): string;
/**
 * Week 10 Message Handler:
 * Primary WhatsApp entry point that shows a typing indicator while processing,
 * invokes orchestrate(), and returns clean WhatsApp markdown.
 */
export declare function onWhatsAppMessage(message: string, userId: string): Promise<string>;
