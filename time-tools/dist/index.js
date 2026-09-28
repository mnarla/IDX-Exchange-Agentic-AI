import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
export default defineToolPlugin({
    id: "time-tools",
    name: "Time Tools",
    description: "Returns the current date and time, optionally for a given IANA timezone.",
    tools: (tool) => [
        tool({
            name: "get_current_time",
            description: "Get the current date and time for a given timezone or local system time.",
            parameters: Type.Object({
                timezone: Type.Optional(Type.String({
                    description: "IANA timezone name, e.g. 'America/Los_Angeles', 'America/New_York', 'UTC'. Defaults to local system timezone.",
                })),
            }),
            execute: async ({ timezone }) => {
                const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
                const now = new Date();
                const formatted = new Intl.DateTimeFormat("en-US", {
                    dateStyle: "full",
                    timeStyle: "long",
                    timeZone: tz,
                }).format(now);
                return {
                    currentTime: formatted,
                    iso: now.toISOString(),
                    timezone: tz,
                };
            },
        }),
    ],
});
