import assert from "node:assert/strict";
import { orchestrate, classifyIntent, setMockQuery, setMockEmbeddingFn } from "../property-db/dist/index.js";
import { getSession, clearSession } from "../property-nlp/dist/index.js";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {}

if (!process.env.MYSQL_USER) {
  console.log("ℹ️  No live MySQL credentials configured. Running with mock real estate dataset.\n");
  setMockQuery(async (sql) => {
    if (sql.includes("GROUP BY DATE_FORMAT")) {
      return [
        { month: "2026-04", sales: 20, avg_price: 900000, avg_price_per_sqft: 640, avg_dom: 22 },
        { month: "2026-05", sales: 22, avg_price: 950000, avg_price_per_sqft: 680, avg_dom: 19 },
      ];
    }
    if (sql.includes("COUNT(*)") && sql.includes("california_sold")) {
      return [
        {
          City: "Pasadena",
          sold_count: 42,
          avg_close_price: 950000,
          avg_price_per_sqft: 680,
          avg_dom: 19,
          list_to_close_pct: 102.1,
        },
      ];
    }
    if (sql.includes("rets_property") && sql.includes("COUNT(*)")) {
      return [{ active_count: 28 }];
    }
    if (sql.includes("ClosePrice") && sql.includes("ORDER BY ClosePrice ASC")) {
      return [{ ClosePrice: 940000 }];
    }
    if (sql.includes("rets_property WHERE L_ListingID = ?")) {
      return [
        {
          L_ListingID: "PAS_ACT_1",
          L_City: "Pasadena",
          price: 799000,
          beds: 3,
          baths: 2,
          sqft: 1500,
          status: "Active",
        },
      ];
    }
    if (sql.includes("L_ListingID <> ?")) {
      return [
        {
          L_ListingID: "PAS_ACT_2",
          L_City: "Pasadena",
          price: 810000,
          beds: 3,
          baths: 2,
          sqft: 1550,
          status: "Active",
        },
      ];
    }
    if (sql.includes("rets_property")) {
      return [
        {
          L_ListingID: "PAS_ACT_1",
          L_DisplayId: "PAS_ACT_1",
          L_Address: "789 Green St",
          L_City: "Pasadena",
          L_Zip: "91101",
          price: 799000,
          beds: 3,
          baths: 2,
          sqft: 1500,
          type: "SingleFamilyResidence",
          status: "Active",
          lat: 34.14,
          lng: -118.14,
          YearBuilt: 2005,
          AssociationFee: 0,
          DaysOnMarket: 10,
          PoolPrivateYN: "0",
          ViewYN: "0",
          FireplaceYN: "1",
          PhotoCount: 15,
          LA1_UserFirstName: "Robert",
          LA1_UserLastName: "Smith",
          LO1_OrganizationName: "Green Realty",
        },
      ];
    }
    if (sql.includes("california_sold")) {
      return [{ avg_ppsf: 530, comp_count: 6 }];
    }
    return [];
  });
  setMockEmbeddingFn(async () => new Array(3072).fill(0.01));
} else {
  console.log("🌐 Connected to live MySQL instance.\n");
}

console.log("=================================================");
console.log("  Week 9: Multi-Agent Orchestrator End-to-End Test");
console.log("=================================================\n");

const userId = "e2e-demo-user";
clearSession(userId);

// 1. Property Search Agent Route
console.log("--- 1. Testing propertySearchAgent Route ---");
const q1 = "Find 3-bed homes in Pasadena under $1.5M";
const intent1 = await classifyIntent(q1);
console.log(`Query: "${q1}"`);
console.log(`Classified Intent: ${intent1}`);
assert.equal(intent1, "search");
const res1 = await orchestrate(q1, userId);
assert.equal(res1.intent, "search");
console.log(`Agents Invoked: propertySearchAgent`);
console.log(`Response Snippet:\n${res1.text.slice(0, 180)}...\n`);

// Verify session memory has recorded the search results
const session1 = getSession(userId);
assert.ok(session1.lastResults?.length, "Session lastResults should be populated");
console.log(`Session memory verified: ${session1.lastResults.length} properties stored for user ${userId}.\n`);

// 2. Market Stats Agent Route
console.log("--- 2. Testing marketStatsAgent Route ---");
const q2 = "What are the market trends in Pasadena?";
const intent2 = await classifyIntent(q2);
console.log(`Query: "${q2}"`);
console.log(`Classified Intent: ${intent2}`);
assert.equal(intent2, "market");
const res2 = await orchestrate(q2, userId);
assert.equal(res2.intent, "market");
console.log(`Agents Invoked: marketStatsAgent`);
console.log(`Response Snippet:\n${res2.text.slice(0, 180)}...\n`);

// 3. Recommendation Agent Route (utilizing prior turn's session memory)
console.log("--- 3. Testing recommendationAgent Route (with Session Memory) ---");
const q3 = "Recommend homes similar to this listing";
const intent3 = await classifyIntent(q3);
console.log(`Query: "${q3}"`);
console.log(`Classified Intent: ${intent3}`);
assert.equal(intent3, "recommend");
const res3 = await orchestrate(q3, userId);
assert.equal(res3.intent, "recommend");
console.log(`Agents Invoked: recommendationAgent`);
console.log(`Target Listing ID from Session: ${res3.listingId}`);
console.log(`Response Snippet:\n${res3.text.slice(0, 180)}...\n`);

// 4. RAG Knowledge Agent Route
console.log("--- 4. Testing ragAgent Route ---");
const q4 = "What is DOM in real estate?";
const intent4 = await classifyIntent(q4);
console.log(`Query: "${q4}"`);
console.log(`Classified Intent: ${intent4}`);
assert.equal(intent4, "knowledge");
const res4 = await orchestrate(q4, userId);
assert.equal(res4.intent, "knowledge");
console.log(`Agents Invoked: ragAgent`);
console.log(`Response Snippet:\n${res4.text.slice(0, 180)}...\n`);

// 5. Email Drafting Agent Route
console.log("--- 5. Testing emailDraftAgent Route ---");
const q5 = "Draft an email to client John with our Pasadena summary";
const intent5 = await classifyIntent(q5);
console.log(`Query: "${q5}"`);
console.log(`Classified Intent: ${intent5}`);
assert.equal(intent5, "email");
const res5 = await orchestrate(q5, userId);
assert.equal(res5.intent, "email");
console.log(`Agents Invoked: emailDraftAgent`);
console.log(`Recipient: ${res5.recipient}`);
console.log(`Subject: ${res5.subject}`);
console.log(`Response Snippet:\n${res5.text.slice(0, 180)}...\n`);

// 6. Mixed-Intent Parallel Execution (Exact Handbook Example)
console.log("--- 6. Testing Mixed-Intent Parallel Route (Handbook Example) ---");
const q6 = "Find me affordable homes in Pasadena and tell me whether prices are rising.";
const intent6 = await classifyIntent(q6);
console.log(`Query: "${q6}"`);
console.log(`Classified Intent: ${intent6}`);
assert.equal(intent6, "mixed");
const res6 = await orchestrate(q6, userId);
assert.equal(res6.intent, "mixed");
console.log(`Agents Invoked in Parallel: propertySearchAgent + marketStatsAgent`);
assert.ok(res6.text.includes("Market Trends"), "Combined text must contain market trends");
assert.ok(res6.text.includes("Matching Active Properties"), "Combined text must contain active listings");
console.log(`Combined Response Snippet:\n${res6.text.slice(0, 300)}...\n`);

// 7. Unknown / Fallback Route
console.log("--- 7. Testing Fallback / Unhandled Query ---");
const q7 = "Can you bake me a chocolate chip cake?";
const intent7 = await classifyIntent(q7);
console.log(`Query: "${q7}"`);
console.log(`Classified Intent: ${intent7}`);
assert.equal(intent7, "unknown");
const res7 = await orchestrate(q7, userId);
assert.equal(res7.intent, "unknown");
assert.equal(res7.response, "I'm not sure how to help with that. Try asking about properties or market trends.");
console.log(`Fallback Response: "${res7.response}"\n`);

console.log("=================================================");
console.log("  ALL 7 END-TO-END ORCHESTRATOR CHECKS PASSED!   ");
console.log("=================================================");
