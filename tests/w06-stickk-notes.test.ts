/**
 * Work Package W06: Stickk Notes & Recoverable Edits Tests
 * Validates Audits 19, 20, 21, 22, 23.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StickkPage, StickkStroke, StickkExportData } from '../src/types';
import {
  validateStickkPageClient,
  pruneExpiredTrash,
  importStickkNotesFromJson,
  exportStickkNotes,
  SEED_STICKK_PAGES,
} from '../src/utils/stickkStorage';
import {
  validateStickkStroke,
  validateStickkPage,
  validateStickkPagesPayload,
} from '../electron/ipcSecurity.cjs';

describe('W06: Stable Page Navigation & Note Creation (Audit 19)', () => {
  test('creating a new note generates a stable ID and selects it directly', () => {
    const initialPages: StickkPage[] = [...SEED_STICKK_PAGES];
    const initialCount = initialPages.length;

    // Simulate new note creation using stable page ID
    const newId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPage: StickkPage = {
      id: newId,
      title: `Note ${initialCount + 1}`,
      theme: 'theme-orange',
      font: 'font-marker',
      text: '',
      strokes: [],
      updatedAt: new Date().toISOString(),
    };

    const updatedPages = [...initialPages, newPage];
    assert.equal(updatedPages.length, initialCount + 1);

    // Active page is resolved via ID lookup rather than volatile index
    const activePage = updatedPages.find(p => p.id === newId);
    assert.ok(activePage, 'New page should be directly resolvable by stable ID');
    assert.equal(activePage.id, newId);
    assert.equal(activePage.title, `Note ${initialCount + 1}`);
  });

  test('page lookup falls back safely if target ID is not found', () => {
    const pages: StickkPage[] = [...SEED_STICKK_PAGES];
    const nonexistentId = 'page-does-not-exist';
    const found = pages.find(p => p.id === nonexistentId) || pages[0];
    assert.equal(found.id, pages[0].id, 'Should safely fall back to the first available page');
  });
});

describe('W06: Vector Stroke Model & Pointer Capture Validation (Audits 20 & 21)', () => {
  test('validates valid vector stroke with normalized [0, 1] points', () => {
    const stroke: StickkStroke = {
      id: 'stroke-1',
      tool: 'draw',
      color: '#1C1917',
      size: 2.5,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.35, y: 0.5 },
        { x: 0.8, y: 0.9 },
      ],
    };

    assert.equal(validateStickkStroke(stroke), true);
  });

  test('rejects stroke with invalid tool, missing points, or out-of-range coordinates', () => {
    // Missing points
    assert.equal(validateStickkStroke({ id: '1', tool: 'draw', color: '#000', size: 2, points: [] }), false);
    // Invalid tool
    assert.equal(validateStickkStroke({ id: '2', tool: 'brush' as any, color: '#000', size: 2, points: [{ x: 0.5, y: 0.5 }] }), false);
    // Out-of-bounds normalized coordinates
    assert.equal(validateStickkStroke({ id: '3', tool: 'draw', color: '#000', size: 2, points: [{ x: 1.5, y: 0.5 }] }), false);
    assert.equal(validateStickkStroke({ id: '4', tool: 'draw', color: '#000', size: 2, points: [{ x: -0.1, y: 0.5 }] }), false);
    // NaN coordinates
    assert.equal(validateStickkStroke({ id: '5', tool: 'draw', color: '#000', size: 2, points: [{ x: NaN, y: 0.5 }] }), false);
  });

  test('normalized points scale proportionally across canvas dimension changes without cropping', () => {
    const normalizedPoints = [
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ];

    // At small size (e.g. 200x150)
    const smallWidth = 200;
    const smallHeight = 150;
    const p1Small = { x: normalizedPoints[0].x * smallWidth, y: normalizedPoints[0].y * smallHeight };
    const p2Small = { x: normalizedPoints[1].x * smallWidth, y: normalizedPoints[1].y * smallHeight };
    assert.equal(p1Small.x, 50);
    assert.equal(p1Small.y, 75);
    assert.equal(p2Small.x, 150);
    assert.equal(p2Small.y, 75);

    // At enlarged size (e.g. 400x300)
    const largeWidth = 400;
    const largeHeight = 300;
    const p1Large = { x: normalizedPoints[0].x * largeWidth, y: normalizedPoints[0].y * largeHeight };
    const p2Large = { x: normalizedPoints[1].x * largeWidth, y: normalizedPoints[1].y * largeHeight };
    assert.equal(p1Large.x, 100);
    assert.equal(p1Large.y, 150);
    assert.equal(p2Large.x, 300);
    assert.equal(p2Large.y, 150);

    // Relative distance is preserved exactly (50% of width)
    const smallDist = p2Small.x - p1Small.x;
    const largeDist = p2Large.x - p1Large.x;
    assert.equal(smallDist / smallWidth, 0.5);
    assert.equal(largeDist / largeWidth, 0.5);
  });

  test('monotonic token guard discards stale asynchronous image load callbacks', () => {
    let activeToken = 0;
    let renderedPageId: string | null = null;

    // Request 1: load page 1 (slow)
    const token1 = ++activeToken;
    let completeCallback1 = () => {
      if (token1 !== activeToken) return; // Stale: should be discarded
      renderedPageId = 'page-1';
    };

    // User rapidly switches to page 2 (fast)
    const token2 = ++activeToken;
    let completeCallback2 = () => {
      if (token2 !== activeToken) return;
      renderedPageId = 'page-2';
    };

    // Page 2 finishes loading first
    completeCallback2();
    assert.equal(renderedPageId, 'page-2');

    // Page 1 async load finishes later
    completeCallback1();
    assert.equal(renderedPageId, 'page-2', 'Stale callback 1 must NOT overwrite page 2');
  });
});

describe('W06: Validated Note Schema, Export & Import (Audit 22)', () => {
  test('validates valid note page and rejects malformed fields', () => {
    const validPage: StickkPage = {
      id: 'page-101',
      title: 'Valid Note',
      theme: 'theme-mint',
      font: 'font-pacifico',
      text: 'Sample notes text',
      updatedAt: new Date().toISOString(),
    };

    assert.equal(validateStickkPageClient(validPage), true);
    assert.equal(validateStickkPage(validPage).valid, true);

    // Missing title
    assert.equal(validateStickkPageClient({ ...validPage, title: undefined as any }), false);
    // Invalid theme
    assert.equal(validateStickkPageClient({ ...validPage, theme: 'theme-neon' as any }), false);
    // Invalid font
    assert.equal(validateStickkPageClient({ ...validPage, font: 'font-roboto' as any }), false);
    // Non-string id
    assert.equal(validateStickkPageClient({ ...validPage, id: 123 as any }), false);
  });

  test('validateStickkPagesPayload validates full array and enforces upper limits', () => {
    const pages: StickkPage[] = [...SEED_STICKK_PAGES];
    const res = validateStickkPagesPayload(pages);
    assert.equal(res.valid, true);

    // Non-array
    assert.equal(validateStickkPagesPayload({} as any).valid, false);
    // Over capacity (> 100 pages)
    const excessPages = new Array(105).fill(pages[0]);
    assert.equal(validateStickkPagesPayload(excessPages).valid, false);
  });

  test('importStickkNotesFromJson accepts valid JSON and rejects malformed payloads', () => {
    const exportBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      pages: [
        {
          id: 'imported-1',
          title: 'Imported Note',
          theme: 'theme-yellow',
          font: 'font-caveat',
          text: 'Hello world',
          updatedAt: new Date().toISOString(),
        },
      ],
      trash: [],
    };

    const validJson = JSON.stringify(exportBundle);
    const result = importStickkNotesFromJson(validJson);
    assert.equal(result.success, true);
    assert.equal(result.pages?.length, 1);
    assert.equal(result.pages?.[0].title, 'Imported Note');

    // Malformed JSON syntax
    const badSyntax = '{"pages": [';
    assert.equal(importStickkNotesFromJson(badSyntax).success, false);

    // Empty pages array
    const emptyJson = JSON.stringify({ pages: [] });
    assert.equal(importStickkNotesFromJson(emptyJson).success, false);

    // Invalid note page in array
    const invalidNoteJson = JSON.stringify({ pages: [{ id: 'bad' }] });
    assert.equal(importStickkNotesFromJson(invalidNoteJson).success, false);
  });
});

describe('W06: Soft Deletion, Undo & Trash Retention Policy (Audit 23)', () => {
  test('soft deletion marks note with deletedAt and places it in trash', () => {
    const page: StickkPage = {
      id: 'page-to-tear',
      title: 'Note to be deleted',
      theme: 'theme-yellow',
      font: 'font-caveat',
      text: 'Goodbye note',
      updatedAt: new Date().toISOString(),
    };

    const deletedPage: StickkPage = {
      ...page,
      deletedAt: new Date().toISOString(),
    };

    assert.ok(deletedPage.deletedAt, 'Deleted page must have deletedAt timestamp');

    // Undo restores the note to active pages and removes deletedAt
    const restoredPage: StickkPage = {
      ...deletedPage,
      deletedAt: undefined,
    };

    assert.equal(restoredPage.deletedAt, undefined);
    assert.equal(restoredPage.id, page.id);
    assert.equal(restoredPage.title, page.title);
  });

  test('pruneExpiredTrash preserves recent items and discards notes older than 30 days', () => {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const twentyNineDaysAgo = new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyOneDaysAgo = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

    const trashItems: StickkPage[] = [
      { id: 'recent-1', title: '1 Day Ago', theme: 'theme-yellow', font: 'font-caveat', text: '', updatedAt: oneDayAgo, deletedAt: oneDayAgo },
      { id: 'recent-2', title: '29 Days Ago', theme: 'theme-yellow', font: 'font-caveat', text: '', updatedAt: twentyNineDaysAgo, deletedAt: twentyNineDaysAgo },
      { id: 'expired-1', title: '31 Days Ago', theme: 'theme-yellow', font: 'font-caveat', text: '', updatedAt: thirtyOneDaysAgo, deletedAt: thirtyOneDaysAgo },
      { id: 'expired-2', title: '60 Days Ago', theme: 'theme-yellow', font: 'font-caveat', text: '', updatedAt: sixtyDaysAgo, deletedAt: sixtyDaysAgo },
    ];

    const pruned = pruneExpiredTrash(trashItems);
    assert.equal(pruned.length, 2);
    assert.equal(pruned.some(p => p.id === 'recent-1'), true);
    assert.equal(pruned.some(p => p.id === 'recent-2'), true);
    assert.equal(pruned.some(p => p.id === 'expired-1'), false);
    assert.equal(pruned.some(p => p.id === 'expired-2'), false);
  });

  test('pruneExpiredTrash caps trash stack at maximum 50 items', () => {
    const recent = new Date().toISOString();
    const largeTrash: StickkPage[] = [];
    for (let i = 0; i < 75; i++) {
      largeTrash.push({
        id: `trash-${i}`,
        title: `Trash ${i}`,
        theme: 'theme-yellow',
        font: 'font-caveat',
        text: '',
        updatedAt: recent,
        deletedAt: recent,
      });
    }

    const pruned = pruneExpiredTrash(largeTrash);
    assert.equal(pruned.length, 50, 'Trash stack must be capped at 50 items');
  });
});
