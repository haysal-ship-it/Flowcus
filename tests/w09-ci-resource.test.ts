/**
 * Work Package W09: CI & Measured Resource Use Tests
 * Validates Audits 30 and 36.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());

describe('W09: CI, Strict Typing & Resource Framework (Audits 30 & 36)', () => {
  describe('Audit 30: Windows CI Workflow & Reproducibility', () => {
    test('verifies .github/workflows/ci.yml exists and defines Windows CI pipeline', () => {
      const ciPath = path.join(ROOT, '.github', 'workflows', 'ci.yml');
      assert.strictEqual(fs.existsSync(ciPath), true, 'Missing .github/workflows/ci.yml');
      const ciContent = fs.readFileSync(ciPath, 'utf8');

      assert.ok(ciContent.includes('windows-latest'), 'CI must run on windows-latest');
      assert.ok(ciContent.includes('node-version: 22'), 'CI must specify documented Node version 22');
      assert.ok(ciContent.includes('npm ci'), 'CI must use reproducible npm ci with lockfile');
      assert.ok(ciContent.includes('npm run typecheck'), 'CI must run separate typecheck');
      assert.ok(ciContent.includes('npm run lint'), 'CI must run separate linter');
      assert.ok(ciContent.includes('npm test'), 'CI must run regression test suite');
      assert.ok(ciContent.includes('npm run build'), 'CI must run client production build');
      assert.ok(ciContent.includes('package:win'), 'CI must verify Windows packaging');
    });

    test('verifies package-lock.json exists and is authoritative lockfile', () => {
      const lockPath = path.join(ROOT, 'package-lock.json');
      assert.strictEqual(fs.existsSync(lockPath), true, 'package-lock.json must exist');
      const stats = fs.statSync(lockPath);
      assert.ok(stats.size > 10000, 'package-lock.json must not be empty');
    });

    test('verifies package.json scripts separate type checking, linting, tests, build, and packaging', () => {
      const pkgPath = path.join(ROOT, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      assert.ok(pkg.scripts.typecheck, 'Missing typecheck script');
      assert.strictEqual(pkg.scripts.typecheck, 'tsc --noEmit');

      assert.ok(pkg.scripts.lint, 'Missing lint script');
      assert.strictEqual(pkg.scripts.lint, 'node scripts/lint.cjs');

      assert.ok(pkg.scripts.test, 'Missing test script');
      assert.ok(pkg.scripts.test.includes('tests/**/*.test.ts'));

      assert.ok(pkg.scripts.build, 'Missing build script');
      assert.strictEqual(pkg.scripts.build, 'vite build');

      assert.ok(pkg.scripts['package:win'], 'Missing package:win script');
      assert.ok(pkg.scripts['dist:win'], 'Missing dist:win script');
    });
  });

  describe('Audit 30: Deferred TypeScript Strictness & Bridge Typing', () => {
    test('verifies tsconfig.json has strict mode enabled and includes tests', () => {
      const tsconfigPath = path.join(ROOT, 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

      assert.strictEqual(tsconfig.compilerOptions.strict, true, 'compilerOptions.strict must be true');
      assert.ok(tsconfig.compilerOptions.types.includes('node'), 'compilerOptions.types must include node');
      assert.ok(tsconfig.compilerOptions.types.includes('vite/client'), 'compilerOptions.types must include vite/client');
      assert.ok(tsconfig.include.includes('src'), 'tsconfig include must include src');
      assert.ok(tsconfig.include.includes('tests'), 'tsconfig include must include tests');
    });

    test('verifies src/types.ts defines explicit contracts for ElectronAPI and bridge', () => {
      const typesPath = path.join(ROOT, 'src', 'types.ts');
      const typesContent = fs.readFileSync(typesPath, 'utf8');

      assert.ok(typesContent.includes('interface ElectronAPI'));
      assert.ok(typesContent.includes('interface AppSettings'));
      assert.ok(typesContent.includes('interface SessionSnapshot'));
      assert.ok(typesContent.includes('interface StoredTimerData'));
      assert.ok(typesContent.includes('interface Window'));
      assert.ok(typesContent.includes('electronAPI?: ElectronAPI'));
    });

    test('verifies no raw bridge bypass calls remain in src', () => {
      const untypedPattern = '(window as any)' + '.electronAPI';
      function checkDir(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules') {
            checkDir(full);
          } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
            const code = fs.readFileSync(full, 'utf8');
            assert.ok(
              !code.includes(untypedPattern),
              `Found untyped bridge call in ${full}`
            );
          }
        }
      }
      checkDir(path.join(ROOT, 'src'));
    });
  });

  describe('Audit 36: Code Quality & Monolithic Leak Protections', () => {
    test('scripts/lint.cjs executes successfully with exit code 0', () => {
      const output = execSync('node scripts/lint.cjs', { cwd: ROOT, encoding: 'utf8' });
      assert.ok(output.includes('0 errors'), 'scripts/lint.cjs must pass with 0 errors');
    });

    test('scripts/measure-performance.cjs exists and is valid', () => {
      const perfScriptPath = path.join(ROOT, 'scripts', 'measure-performance.cjs');
      assert.strictEqual(fs.existsSync(perfScriptPath), true, 'Missing measure-performance.cjs');
      const content = fs.readFileSync(perfScriptPath, 'utf8');
      assert.ok(content.includes('runScenario'), 'Missing runScenario function');
      assert.ok(content.includes('runLeakInvestigation'), 'Missing runLeakInvestigation function');
      assert.ok(content.includes('Uwidgets.exe'), 'Must reference packaged Uwidgets.exe');
    });
  });
});
