import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { searchRealEstateKnowledge } from '../property-db/dist/knowledge.js';
const questions = [
 ['What does DOM mean?', /days\s+on\s+market/i],
 ['What columns are in california_sold?', /ClosePrice/],
 ['What is a list-to-close ratio?', /ratio/i],
];
const results = process.argv[2] ? JSON.parse(await readFile(new URL('../knowledge/e2e-results.json', import.meta.url), 'utf8')).filter(r => !r.question.includes(process.argv[2])) : [];
for (const [question, expected] of questions.filter(([q]) => !process.argv[2] || q.includes(process.argv[2]))) {
 const retrieval = await searchRealEstateKnowledge({ query: question, topK: 8 });
 assert.ok(!retrieval.error, retrieval.error);
 assert.ok(retrieval.matches.length, 'No evidence retrieved');
 assert.match(retrieval.matches.map(m => m.content).join('\n'), expected);
 const prompt = `Use search_real_estate_knowledge with topK 8 to answer: ${question} Answer only from retrieved evidence. Cite source IDs in square brackets plus document title and page. For a table-column question only, enumerate documented columns across both schema pages and acknowledge completeness limitations. For the ratio question, explicitly distinguish ListPrice at contract from OriginalListPrice using the schema evidence. Keep definition answers under 120 words. For schema list column names only, grouped by source page. Do not use other tools.`;
 const path = `/tmp/idx-rag-question-${results.length}.txt`;
 await writeFile(path, prompt);
 const run = spawnSync('openclaw', ['agent','exec','--json','--timeout','120','--message-file',path], { encoding:'utf8', maxBuffer: 4e6 });
 assert.equal(run.status, 0, run.stderr || run.stdout);
 const envelope = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')));
 assert.equal(envelope.ok, true, JSON.stringify(envelope));
 assert.match(envelope.final || '', expected);
 if (question.includes('ratio')) {
  assert.match(envelope.final, /ClosePrice\s*(?:\/|divided by)\s*(?:NULLIF\(\s*)?ListPrice/i);
  assert.doesNotMatch(envelope.final, /ListPrice\s*\/\s*ClosePrice/i);
  assert.doesNotMatch(envelope.final, /divided by (?:the )?original list price/i);
 }
 assert.match(envelope.final || '', /\[S\d+(?:[^\]]*)\]/, 'Generated answer must cite a source');
 for (const citation of (envelope.final || '').matchAll(/\[(S\d+)(?:[^\]]*)\]/g)) assert.ok(retrieval.matches.some(m => m.id === citation[1]), `Unknown citation ${citation[1]}`);
 if (question.includes('columns')) {
  assert.match(envelope.final, /PurchaseContractDate|PurchaseContractDa/);
  assert.match(envelope.final, /ListingKey/);
  assert.match(envelope.final, /BedroomsTotal/);
  assert.match(envelope.final, /BathroomsTotalInteger|BathroomsTotalInte/);
  assert.match(envelope.final, /YearBuilt/);
 }
 results.push({question, retrieval, generation:envelope});
 await writeFile(new URL('../knowledge/e2e-results.json', import.meta.url), JSON.stringify(results,null,2));
 console.log(`PASS: ${question}`);
}
await writeFile(new URL('../knowledge/e2e-results.json', import.meta.url), JSON.stringify(results,null,2));
console.log('Saved knowledge/e2e-results.json; inspect generated answers for grounding.');
