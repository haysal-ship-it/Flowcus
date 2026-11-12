/**
 * Uwidgets Source & Code Quality Linter (W09 - Audit 30 & 36)
 * Enforces:
 * 1. Valid UTF-8 encoding (no mojibake, no replacement characters \uFFFD).
 * 2. No blanket @ts-ignore or @ts-nocheck suppression without approval.
 * 3. Strict typed IPC usage (no raw `(window as any).electronAPI`).
 * 4. No leftover `debugger;` statements.
 * 5. Valid JSON formatting for configuration and metadata.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src', 'electron', 'tests'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.cjs', '.css', '.json', '.html'];

let totalFiles = 0;
let errorCount = 0;
const errors = [];

function walk(dir) {
  const fullPath = path.join(ROOT, dir);
  if (!fs.existsSync(fullPath)) return [];
  let files = [];
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files = files.concat(walk(rel));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.includes(ext)) {
        files.push(rel);
      }
    }
  }
  return files;
}

console.log('Running Uwidgets project linter...\n');

const allFiles = SCAN_DIRS.flatMap(walk).concat(['index.html']);

for (const relFile of allFiles) {
  totalFiles++;
  const fullPath = path.join(ROOT, relFile);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. Character integrity / mojibake (excluding assertion strings in tests)
    if (!relFile.startsWith('tests') && (line.includes('\uFFFD') || line.includes('â€”') || line.includes('â€“'))) {
      errors.push(`${relFile}:${lineNum} - Corrupted character / mojibake detected: ${line.trim()}`);
      errorCount++;
    }

    // 2. Blanket ts-ignore or ts-nocheck
    if (/\/\/\s*@ts-(ignore|nocheck)/.test(line)) {
      errors.push(`${relFile}:${lineNum} - Unaudited @ts-ignore/@ts-nocheck directive: ${line.trim()}`);
      errorCount++;
    }

    // 3. Untyped bridge call in application source
    if (relFile.startsWith('src') && line.includes('(window as any).electronAPI')) {
      errors.push(`${relFile}:${lineNum} - Untyped bridge usage. Use typed window.electronAPI: ${line.trim()}`);
      errorCount++;
    }

    // 4. Debugger statement
    if (/\bdebugger\s*;/.test(line)) {
      errors.push(`${relFile}:${lineNum} - Leftover debugger statement: ${line.trim()}`);
      errorCount++;
    }
  });

  // 5. JSON validation
  if (relFile.endsWith('.json')) {
    try {
      JSON.parse(content);
    } catch (err) {
      errors.push(`${relFile} - Invalid JSON syntax: ${err.message}`);
      errorCount++;
    }
  }
}

if (errorCount > 0) {
  console.error(`Linting failed with ${errorCount} error(s) across ${totalFiles} files:\n`);
  errors.forEach(e => console.error(`  ✖ ${e}`));
  process.exit(1);
} else {
  console.log(`✔ All ${totalFiles} scanned files passed linting with 0 errors.`);
  process.exit(0);
}
