#!/usr/bin/env node
/**
 * Fails when actionable JSX in product components is missing `data-testid`.
 * BugBug's preferred selector is a product-owned test attribute
 * (`//button[@data-testid='…']` / `button[data-testid='…']`).
 *
 * Used by `npm run verify:bugbug-selectors` and `.husky/pre-push`.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const ACTIONABLE_TAGS = [
  'button',
  'input',
  'select',
  'textarea',
  'Button',
  'Input',
  'Textarea',
  'Checkbox',
  'Switch',
  'SelectTrigger',
  'SelectItem',
  'RadioGroupItem',
  'DialogContent',
  'DialogClose',
  'DropdownMenuTrigger',
  'DropdownMenuItem',
  'CollapsibleTrigger',
  'PopoverTrigger',
  'UiLink',
  'TableRow',
];

const TAG_PATTERN = ACTIONABLE_TAGS.slice().sort((a, b) => b.length - a.length).join('|');
const OPEN_TAG_RE = new RegExp(`<(${TAG_PATTERN})(?=[\\s>\\/])`, 'g');

function toPosix(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function isProductComponent(relPath) {
  const rel = toPosix(relPath);
  if (!rel.startsWith('src/') || !rel.endsWith('.tsx')) {
    return false;
  }
  if (rel.includes('.test.tsx') || rel.includes('.spec.tsx') || rel.includes('.stories.tsx')) {
    return false;
  }
  if (rel.startsWith('src/components/ui/')) {
    return false;
  }
  return true;
}

function stripJsxComments(source) {
  return source.replace(/\{\/\*[\s\S]*?\*\/\}/g, (match) => ' '.repeat(match.length));
}

function findOpeningTagEnd(source, start) {
  let quote = null;
  let brace = 0;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\' && i + 1 < source.length) {
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      brace += 1;
      continue;
    }
    if (ch === '}') {
      brace = Math.max(0, brace - 1);
      continue;
    }
    if (brace === 0 && ch === '>') {
      return i;
    }
  }
  return -1;
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function findMissingTestIds(source) {
  const scanned = stripJsxComments(source);
  const missing = [];
  OPEN_TAG_RE.lastIndex = 0;
  let match = OPEN_TAG_RE.exec(scanned);
  while (match) {
    const tag = match[1];
    const start = match.index;
    const end = findOpeningTagEnd(scanned, start);
    if (end === -1) {
      match = OPEN_TAG_RE.exec(scanned);
      continue;
    }
    const opening = scanned.slice(start, end + 1);
    const skipAsChild =
      /\basChild\b/.test(opening) && (tag === 'Button' || tag === 'UiLink' || tag === 'DialogTrigger' || tag === 'DialogClose');
    if (skipAsChild || /\bdata-testid\b/.test(opening)) {
      match = OPEN_TAG_RE.exec(scanned);
      continue;
    }
    if (tag === 'TableRow' && !/\bonClick\b/.test(opening) && !/\bonKeyDown\b/.test(opening)) {
      match = OPEN_TAG_RE.exec(scanned);
      continue;
    }
    missing.push({
      tag,
      line: lineNumberAt(source, start),
      opening: opening.replace(/\s+/g, ' ').trim(),
    });
    match = OPEN_TAG_RE.exec(scanned);
  }
  return missing;
}

function gitLines(args) {
  try {
    const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    return out ? out.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function listChangedFiles() {
  if (process.env.BUGBUG_SELECTOR_FILES) {
    return process.env.BUGBUG_SELECTOR_FILES.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  const explicitBase = process.env.BUGBUG_SELECTOR_BASE;
  if (explicitBase) {
    return gitLines(['diff', '--name-only', `${explicitBase}...HEAD`]);
  }
  const upstream = gitLines(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const committed = upstream[0]
    ? gitLines(['diff', '--name-only', '@{u}...HEAD'])
    : gitLines(['diff', '--name-only', 'origin/develop...HEAD']);
  const workingTree = [
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['diff', '--name-only', '--cached']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
  return [...new Set([...committed, ...workingTree])];
}

function listAllProductFiles(dir = path.join(ROOT, 'src')) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listAllProductFiles(full));
      continue;
    }
    const rel = toPosix(path.relative(ROOT, full));
    if (isProductComponent(rel)) {
      found.push(rel);
    }
  }
  return found;
}

function parseArgs(argv) {
  return {
    changed: argv.includes('--changed'),
    all: argv.includes('--all'),
  };
}

function formatReport(findings) {
  const lines = ['BugBug selectors: actionable controls must have data-testid (see .cursor/rules/data-testid-bugbug.mdc).'];
  for (const finding of findings) {
    lines.push(`  ${finding.file}:${finding.line} <${finding.tag}> ${finding.opening.slice(0, 120)}`);
  }
  return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const candidates = options.all
    ? listAllProductFiles()
    : options.changed
      ? listChangedFiles().filter(isProductComponent)
      : listChangedFiles().filter(isProductComponent);
  const findings = [];
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      continue;
    }
    for (const miss of findMissingTestIds(fs.readFileSync(abs, 'utf8'))) {
      findings.push({ file: rel, ...miss });
    }
  }
  if (findings.length > 0) {
    process.stderr.write(formatReport(findings));
    process.exitCode = 1;
    return findings;
  }
  const scope = options.all ? 'all product TSX' : `${candidates.length} changed product TSX file(s)`;
  process.stdout.write(`BugBug selectors: OK (${scope})\n`);
  return findings;
}

module.exports = {
  ACTIONABLE_TAGS,
  findMissingTestIds,
  isProductComponent,
  main,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
