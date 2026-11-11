import { writeFile } from 'node:fs/promises';
import { getMarketStatistics } from '../property-db/dist/market.js';
import { closePool } from '../property-db/dist/db.js';
const city = process.argv[2];
if (!city?.trim()) throw new Error('Usage: node --env-file=.env scripts/export_market_knowledge.mjs Pasadena');
try {
 const result = await getMarketStatistics({ city, months: 12 });
 if (result.error) throw new Error(result.error);
 await writeFile(new URL('../knowledge/sources/week5-market.json', import.meta.url), JSON.stringify([{
  title: `Week 5 market analytics: ${city}`,
  location: `Generated ${new Date().toISOString()}, 12-month window`,
  content: result.text,
 }],null,2));
 console.log('Saved market report. Re-run scripts/index_knowledge.mjs to index it.');
} finally { await closePool(); }
