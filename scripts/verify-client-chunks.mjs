#!/usr/bin/env node
/**
 * Additional safeguard
 * After `next build`, fail if known Emporix integration symbols appear in static JS chunks.
 *
 * Client chunks live under `.next/static/chunks` by default. With
 * `experimental.supportsImmutableAssets` (forced on by Vercel's Next.js 16.3+ builder)
 * Turbopack emits them under `.next/static/immutable/chunks` instead, so both layouts are scanned.
 */
import fs from 'fs';
import path from 'path';

const CANDIDATE_CHUNK_DIRS = ['.next/static/chunks', '.next/static/immutable/chunks'];
const forbidden = [
  'EmporixApiInvokerServer',
  'EmporixApiInvokerSSR',
  'EmporixOAuthApiServer',
  'EmporixOAuthApiSSR',
  'EmporixCartApi',
  'debug-utils',
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.mjs'))) acc.push(p);
  }
  return acc;
}

const scannedDirs = CANDIDATE_CHUNK_DIRS.filter((dir) => fs.existsSync(path.join(process.cwd(), dir)));

if (scannedDirs.length === 0) {
  const expected = CANDIDATE_CHUNK_DIRS.map((dir) => path.join(process.cwd(), dir)).join(' or ');
  console.error(`verify-client-chunks: missing ${expected} — run "next build" first.`);
  process.exit(1);
}

const hits = [];
for (const dir of scannedDirs) {
  for (const file of walk(path.join(process.cwd(), dir))) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const sym of forbidden) {
      if (content.includes(sym)) {
        hits.push({ file, sym });
      }
    }
  }
}

if (hits.length > 0) {
  console.error('verify-client-chunks: forbidden symbols found in client chunks:');
  for (const h of hits) {
    console.error(`  ${h.sym} → ${path.relative(process.cwd(), h.file)}`);
  }
  process.exit(1);
}

console.log(`verify-client-chunks: OK (no forbidden Emporix symbols in ${scannedDirs.join(', ')}).`);
