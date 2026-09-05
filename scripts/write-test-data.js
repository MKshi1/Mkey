import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createStressVault } from './generate-test-data.js';

const outputPath = resolve(process.argv[2] ?? 'test-data/mkey-stress-import.json');
const vault = createStressVault();
const json = `${JSON.stringify(vault, null, 2)}\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, json, 'utf8');

const bookmarks = vault.sites.reduce((count, entry) => count + entry.bookmarks.length, 0);
const credentials = vault.sites.reduce((count, entry) => count + entry.credentials.length, 0);
console.log(JSON.stringify({ outputPath, bytes: Buffer.byteLength(json), entries: vault.sites.length, bookmarks, credentials }));
