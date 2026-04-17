#!/usr/bin/env node
/**
 * Additional safeguard
 * After `next build`, fail if known Emporix integration symbols appear in static JS chunks.
 */
import fs from 'fs';
import path from 'path';

const chunksDir = path.join(process.cwd(), '.next', 'static', 'chunks');
const forbidden = ['EmporixApiInvoker', 'EmporixOAuthApi', 'EmporixCartApi'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.mjs'))) acc.push(p);
  }
  return acc;
}

if (!fs.existsSync(chunksDir)) {
  console.error(`verify-client-chunks: missing ${chunksDir} — run "next build" first.`);
  process.exit(1);
}

const hits = [];
for (const file of walk(chunksDir)) {
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

if (hits.length > 0) {
  console.error('verify-client-chunks: forbidden symbols found in client chunks:');
  for (const h of hits) {
    console.error(`  ${h.sym} → ${path.relative(process.cwd(), h.file)}`);
  }
  process.exit(1);
}

console.log('verify-client-chunks: OK (no forbidden Emporix symbols in .next/static/chunks).');
