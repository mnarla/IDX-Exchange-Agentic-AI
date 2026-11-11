import { describe, it, expect } from 'vitest';
import { chunkText, buildIndex, retrieveKnowledge } from './knowledge.js';
const embed = async (text: string) => [text.toLowerCase().includes('dom') ? 1 : 0, text.includes('california_sold') ? 1 : 0, text.includes('ratio') ? 1 : 0];
describe('document knowledge pipeline', () => {
 it('indexes and retrieves the three questions with source citations', async () => {
  const docs = [
   { title: 'Primer', location: 'page 2', content: 'DOM means Days on Market.' },
   { title: 'Schema', location: 'page 4', content: 'california_sold columns: ClosePrice, ListPrice, DaysOnMarket.' },
   { title: 'Primer', location: 'page 3', content: 'List-to-close ratio is ClosePrice divided by ListPrice times 100.' },
  ];
  const index = await buildIndex(docs, embed, 'test');
  for (const [q, expected] of [['What does DOM mean?', 'Days on Market'], ['What columns are in california_sold?', 'ClosePrice'], ['What is a list-to-close ratio?', 'divided']]) {
   const result = await retrieveKnowledge(q, index, embed, 1);
   expect(result.matches[0].content).toContain(expected);
   expect(result.matches[0].citation).toMatch(/page/);
  }
 });
 it('returns full page context so schema continuations are not truncated', async () => {
  const index = await buildIndex([{ title: 'Schema', location: 'page 5', content: 'california_sold '.repeat(150) + 'BedroomsTotal BathroomsTotalInteger YearBuilt' }], embed, 'test');
  const r = await retrieveKnowledge('california_sold', index, embed, 1);
  expect(r.matches[0].content).toContain('BedroomsTotal');
 });
 it('rejects invalid chunk sizes and incompatible vectors', async () => {
  expect(() => chunkText('abc', 10, 10)).toThrow();
  const index = await buildIndex([{ title: 'Test', location: 'p1', content: 'DOM' }], embed, 'test');
  await expect(retrieveKnowledge('DOM', index, async () => [1])).rejects.toThrow(/dimension/);
 });
 it('abstains for no evidence and retains the end of long documents', async () => {
  expect(chunkText('a'.repeat(1400)+'THE END').join('')).toContain('THE END');
  const index = await buildIndex([{ title: 'Primer', location: 'p1', content: 'DOM' }], embed, 'test');
  expect((await retrieveKnowledge('quantum physics', index, async () => [0,0,1])).matches).toEqual([]);
 });
});
