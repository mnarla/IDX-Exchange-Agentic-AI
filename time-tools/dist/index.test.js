import { describe, expect, it } from "vitest";
import entry from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
describe("time-tools", () => {
    it("declares tool metadata", () => {
        expect(getToolPluginMetadata(entry)?.tools.map((tool) => tool.name)).toEqual(["get_current_time"]);
    });
});
