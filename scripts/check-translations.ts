#!/usr/bin/env ts-node
/**
 * check-translations.ts
 *
 * Build-time validation that translation keys used in source code are present
 * in the translation JSON files.
 *
 * Behavior:
 *  - The default locale (from i18n/routing.ts) is ALWAYS checked as the
 *    mandatory fallback. Missing keys in the default locale are logged as
 *    warnings (and cause a non-zero exit code when --strict is passed).
 *  - Additional locales can be checked with:
 *      --locales allLanguages   (auto-discovers every folder in translations/)
 *      --locales de             (one specific locale)
 *      --locales de,fr          (comma-separated list)
 *  - Without --locales only the default locale is validated.
 *  - --strict  makes any warning an error (non-zero exit code → breaks build).
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/check-translations.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/check-translations.ts --locales allLanguages
 *   npx ts-node --project scripts/tsconfig.json scripts/check-translations.ts --locales de --strict
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TRANSLATIONS_DIR = path.join(SRC, 'i18n', 'translations');

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const STRICT = args.includes('--strict');

function getRequestedLocales(): string[] | 'allLanguages' {
  const idx = args.indexOf('--locales');
  if (idx === -1 || idx + 1 >= args.length) return [];
  const val = args[idx + 1];
  if (val === 'allLanguages') return 'allLanguages';
  return val.split(',').map((l) => l.trim()).filter(Boolean);
}

// ── Default locale (read from routing.ts at parse time) ────────────────────
function readDefaultLocale(): string {
  const routingPath = path.join(SRC, 'i18n', 'routing.ts');
  const content = fs.readFileSync(routingPath, 'utf-8');
  const m = content.match(/defaultLocale:\s*['"]([^'"]+)['"]/);
  return m ? m[1] : 'en';
}

const DEFAULT_LOCALE = readDefaultLocale();

// ── Discover available locales from folder names ───────────────────────────
function discoverLocales(): string[] {
  return fs
    .readdirSync(TRANSLATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '.' && d.name !== '..')
    .map((d) => d.name);
}

// ── Build final list of locales to check ───────────────────────────────────
function resolveLocales(): string[] {
  const requested = getRequestedLocales();
  const locales = new Set<string>();
  locales.add(DEFAULT_LOCALE); // always include default

  if (requested === 'allLanguages') {
    discoverLocales().forEach((l) => locales.add(l));
  } else if (Array.isArray(requested)) {
    requested.forEach((l) => locales.add(l));
  }

  return Array.from(locales);
}

// ── Load all translation keys for a locale into a flat set ─────────────────
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    // Always add the key (even if it's a branch / namespace node),
    // because next-intl allows t('branchKey') which returns the whole sub-tree.
    keys.push(fullKey);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, fullKey));
    }
  }
  return keys;
}

function loadTranslationKeys(locale: string): Map<string, Set<string>> {
  const namespaceMap = new Map<string, Set<string>>();
  const localeDir = path.join(TRANSLATIONS_DIR, locale);
  if (!fs.existsSync(localeDir)) return namespaceMap;

  const files = glob.sync('*/index.json', { cwd: localeDir });
  for (const file of files) {
    const ns = path.dirname(file); // e.g. "account"
    const json = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf-8'));
    const keys = flattenKeys(json);
    namespaceMap.set(ns, new Set(keys));
  }
  return namespaceMap;
}

// ── Extract used translation keys from source code ─────────────────────────

interface UsedKey {
  namespace: string; // root namespace e.g. "checkout"
  subPath: string;   // sub-namespace path e.g. "shipping" or ""
  key: string;       // the key passed to t() e.g. "cancel"
  file: string;      // source file (relative)
  line: number;
}

/**
 * Parse source files and extract namespace + key information.
 *
 * Handles:
 *   useTranslations('checkout')          → ns="checkout", subPath=""
 *   useTranslations('checkout.shipping') → ns="checkout", subPath="shipping"
 *   getTranslations({ ..., namespace: 'orders.Approval' })
 *   getTranslations({ locale, namespace: 'orders' })
 *
 * Scopes variables to the function they are defined in so that multiple
 * components in one file (e.g. footer.tsx with Footer, FooterLinks,
 * LegalFooter) each using `const t = useTranslations(...)` don't
 * cross-contaminate.
 */
function extractUsedKeys(): UsedKey[] {
  const srcFiles = glob.sync('**/*.{ts,tsx}', {
    cwd: SRC,
    ignore: ['**/*.test.*', '**/*.spec.*', '**/tests/**', '**/__mocks__/**'],
  });

  const result: UsedKey[] = [];

  // Patterns for translation hook/function calls
  const useTranslationsRe =
    /\b(?:const|let)\s+(\w+)\s*=\s*(?:useTranslations|await\s+getTranslations)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const getTranslationsObjRe =
    /\b(?:const|let)\s+(\w+)\s*=\s*(?:useTranslations|await\s+getTranslations)\s*\(\s*\{[^}]*namespace:\s*['"]([^'"]+)['"][^}]*\}\s*\)/g;

  for (const relFile of srcFiles) {
    const absPath = path.join(SRC, relFile);
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');

    // ── Step 1: Find function boundaries ──────────────────────────────
    // Detect top-level (exported) function starts and track brace depth
    // to determine where each function ends. This lets us scope variables.
    type FnRange = { start: number; end: number };
    const fnRanges: FnRange[] = [];

    const fnStartRe = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+\w+/;
    // Also handle arrow-function components: export const Foo = (...) => {
    const arrowFnRe = /^(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:\([^)]*\)|[^=])*=>\s*\{?/;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (fnStartRe.test(trimmed) || arrowFnRe.test(trimmed)) {
        // Walk forward counting braces to find the end
        let depth = 0;
        let foundOpen = false;
        let endLine = i;
        for (let j = i; j < lines.length; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') { depth++; foundOpen = true; }
            if (ch === '}') depth--;
          }
          if (foundOpen && depth <= 0) { endLine = j; break; }
        }
        fnRanges.push({ start: i, end: endLine });
      }
    }

    // ── Step 2: Collect variable → namespace mappings with line info ──
    const varMappings: Array<{
      varName: string; rootNs: string; subPath: string; definedLine: number;
    }> = [];

    for (const re of [useTranslationsRe, getTranslationsObjRe]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const varName = m[1];
        const fullNs = m[2];
        const dotIdx = fullNs.indexOf('.');
        const rootNs = dotIdx >= 0 ? fullNs.substring(0, dotIdx) : fullNs;
        const subPath = dotIdx >= 0 ? fullNs.substring(dotIdx + 1) : '';
        const lineNum = content.substring(0, m.index).split('\n').length;
        varMappings.push({ varName, rootNs, subPath, definedLine: lineNum });
      }
    }

    if (varMappings.length === 0) continue;

    // ── Step 3: For each variable, find `t('key')` calls in scope ────
    for (const mapping of varMappings) {
      // Determine function scope for this variable
      const defLine0 = mapping.definedLine - 1; // 0-based
      const scope = fnRanges.find((r) => defLine0 >= r.start && defLine0 <= r.end);

      // Build a substring of the file within scope (or whole file if no scope)
      let searchContent: string;
      let lineOffset: number; // how many lines before searchContent starts
      if (scope) {
        searchContent = lines.slice(scope.start, scope.end + 1).join('\n');
        lineOffset = scope.start;
      } else {
        searchContent = content;
        lineOffset = 0;
      }

      const callRe = new RegExp(
        `\\b${escapeRegExp(mapping.varName)}(?:\\.\\w+)?\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
        'g',
      );
      callRe.lastIndex = 0;
      let cm: RegExpExecArray | null;
      while ((cm = callRe.exec(searchContent)) !== null) {
        const key = cm[1];
        if (key.includes('${') || key.includes('+')) continue;
        // Skip keys that look like partial dynamic keys (end with . or start with .)
        if (key.endsWith('.') || key.startsWith('.')) continue;
        const lineInScope = searchContent.substring(0, cm.index).split('\n').length;
        const lineNum = lineInScope + lineOffset;
        result.push({
          namespace: mapping.rootNs,
          subPath: mapping.subPath,
          key,
          file: relFile,
          line: lineNum,
        });
      }
    }
  }

  // ── Step 4: Detect l10n('namespace.key') calls ─────────────────────────
  // The l10n() helper uses fully-qualified keys like 'quick-order.search.noResults'
  // where the first segment is the translation namespace.
  const l10nRe = /\bl10n\s*\(\s*['"]([a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)+)['"]\s*\)/g;

  for (const relFile of srcFiles) {
    const absPath = path.join(SRC, relFile);
    const content = fs.readFileSync(absPath, 'utf-8');

    l10nRe.lastIndex = 0;
    let lm: RegExpExecArray | null;
    while ((lm = l10nRe.exec(content)) !== null) {
      const fullKey = lm[1];
      const dotIdx = fullKey.indexOf('.');
      if (dotIdx < 0) continue;
      const namespace = fullKey.substring(0, dotIdx);
      const key = fullKey.substring(dotIdx + 1);
      if (key.includes('${') || key.includes('+')) continue;
      const lineNum = content.substring(0, lm.index).split('\n').length;
      result.push({ namespace, subPath: '', key, file: relFile, line: lineNum });
    }
  }

  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const locales = resolveLocales();
  console.log(`\n🔍 Checking translations for locales: ${locales.join(', ')} (default: ${DEFAULT_LOCALE})\n`);

  // 1. Extract all used keys from source
  const usedKeys = extractUsedKeys();
  console.log(`   Found ${usedKeys.length} translation key references in source code.\n`);

  // 2. For each locale, check for missing keys
  let totalWarnings = 0;

  for (const locale of locales) {
    const isDefault = locale === DEFAULT_LOCALE;
    const nsKeys = loadTranslationKeys(locale);
    const missingEntries: Array<{ key: string; fullPath: string; file: string; line: number }> = [];

    for (const used of usedKeys) {
      const availableKeys = nsKeys.get(used.namespace);
      if (!availableKeys) {
        // Entire namespace missing for this locale — only warn for default
        if (isDefault) {
          missingEntries.push({
            key: `${used.namespace}.*`,
            fullPath: used.subPath ? `${used.subPath}.${used.key}` : used.key,
            file: used.file,
            line: used.line,
          });
        }
        continue;
      }

      // Build the full key path within the namespace file
      const fullKey = used.subPath ? `${used.subPath}.${used.key}` : used.key;

      if (!availableKeys.has(fullKey)) {
        missingEntries.push({
          key: `${used.namespace}.${fullKey}`,
          fullPath: fullKey,
          file: used.file,
          line: used.line,
        });
      }
    }

    // De-duplicate (same key referenced from multiple places)
    const uniqueMissing = new Map<string, { files: string[]; key: string }>();
    for (const entry of missingEntries) {
      const existing = uniqueMissing.get(entry.key);
      if (existing) {
        const loc = `${entry.file}:${entry.line}`;
        if (!existing.files.includes(loc)) existing.files.push(loc);
      } else {
        uniqueMissing.set(entry.key, {
          key: entry.key,
          files: [`${entry.file}:${entry.line}`],
        });
      }
    }

    if (uniqueMissing.size > 0) {
      const label = isDefault ? '⚠️  WARNING (default locale)' : 'ℹ️  INFO';
      console.log(`${label} — ${locale}: ${uniqueMissing.size} missing translation key(s):\n`);
      for (const [key, info] of uniqueMissing) {
        console.log(`   ❌ ${key}`);
        for (const f of info.files.slice(0, 3)) {
          console.log(`      └─ ${f}`);
        }
        if (info.files.length > 3) {
          console.log(`      └─ ... and ${info.files.length - 3} more`);
        }
      }
      console.log('');
      if (isDefault) totalWarnings += uniqueMissing.size;
    } else {
      console.log(`   ✅ ${locale}: All translation keys present.\n`);
    }
  }

  // 3. Summary
  if (totalWarnings > 0) {
    console.log(`\n⚠️  Total: ${totalWarnings} missing key(s) in default locale "${DEFAULT_LOCALE}".`);
    if (STRICT) {
      console.log('   --strict mode: exiting with error.\n');
      process.exit(1);
    } else {
      console.log('   These are warnings only. Use --strict to fail the build.\n');
    }
  } else {
    console.log(`✅ All translation keys OK for checked locales.\n`);
  }
}

main();
