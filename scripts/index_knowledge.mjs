import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { buildIndex, defaultIndexPath } from '../property-db/dist/knowledge.js';
import { getEmbedding } from '../property-db/dist/vector.js';
const folder = new URL('../knowledge/sources/', import.meta.url);
const docs = [];
for (const name of (await readdir(folder)).sort()) {
 if (name.endsWith('.json')) docs.push(...JSON.parse(await readFile(new URL(name, folder), 'utf8')));
}
const provider = process.env.KNOWLEDGE_EMBEDDING_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai');
if (!['gemini','openai'].includes(provider)) throw new Error('Invalid provider');
const model = process.env.KNOWLEDGE_EMBEDDING_MODEL || (provider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small');
let previous;
try { previous = JSON.parse(await readFile(defaultIndexPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const cachePath = defaultIndexPath + '.cache';
let cache = {};
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const embed = async text => {
 const key = JSON.stringify([provider, model, text]);
 if (cache[key]) return cache[key];
 for (let attempt = 0; ; attempt++) {
  try {
   const vector = await getEmbedding(text, { provider, model });
   cache[key] = vector;
   await writeFile(cachePath, JSON.stringify(cache));
   await new Promise(resolve => setTimeout(resolve, 1800));
   return vector;
  } catch (error) {
   if (attempt >= 4 || !String(error).includes('(429)')) throw error;
   console.log('Embedding rate limit; retrying in 40 seconds');
   await new Promise(resolve => setTimeout(resolve, 40000));
  }
 }
};
const index = await buildIndex(docs, embed, `${provider}:${model}`, previous);
await writeFile(defaultIndexPath + '.tmp', JSON.stringify(index));
await rename(defaultIndexPath + '.tmp', defaultIndexPath);
console.log(`Indexed ${docs.length} source sections, ${index.chunks.length} chunks with ${index.model}`);
