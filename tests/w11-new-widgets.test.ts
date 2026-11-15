/**
 * Work Package W11: New Widgets Suite (Blockz, Quotz, Ayah, Statz, Rowz) Tests
 * Validates pure logic engines, offline wisdom data integrity, and system monitoring.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  createEmptyBoard,
  canPlacePiece,
  lockPiece,
  clearFullLines,
  getGhostY,
  calculateScore,
  TETROMINOES,
  TetrominoType,
} from '../src/components/blockz/blockzLogic';

import {
  ROWZ_COLS,
  ROWZ_ROWS,
  createEmptyRowzBoard,
  canDropInColumn,
  dropDisc,
  checkRowzWinner,
  isRowzBoardFull,
  computeRowzCpuMove,
} from '../src/components/rowz/rowzLogic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

describe('W11: Blockz Tetris Pure Logic Engine', () => {
  test('creates empty 10x20 board', () => {
    const board = createEmptyBoard();
    assert.strictEqual(board.length, BOARD_HEIGHT);
    assert.strictEqual(board[0].length, BOARD_WIDTH);
    assert.ok(board.every(row => row.every(cell => cell === null)));
  });

  test('validates piece boundary and collision checks', () => {
    const board = createEmptyBoard();

    // Valid placement at top center
    assert.strictEqual(canPlacePiece(board, 'T', 0, 3, 0), true);

    // Out of left bound
    assert.strictEqual(canPlacePiece(board, 'T', 0, -2, 0), false);

    // Out of right bound
    assert.strictEqual(canPlacePiece(board, 'T', 0, BOARD_WIDTH, 0), false);

    // Out of floor bound
    assert.strictEqual(canPlacePiece(board, 'T', 0, 3, BOARD_HEIGHT), false);

    // Collision with locked block
    board[10][4] = '#FFFFFF';
    assert.strictEqual(canPlacePiece(board, 'T', 0, 3, 9), false);
  });

  test('correctly locks pieces into board and computes ghost piece Y', () => {
    const board = createEmptyBoard();
    const ghostY = getGhostY(board, 'O', 0, 4, 0);

    // In an empty board, 2x2 O-piece should drop down to row 18 (rows 18 and 19)
    assert.strictEqual(ghostY, BOARD_HEIGHT - 2);

    const locked = lockPiece(board, 'O', 0, 4, ghostY);
    assert.strictEqual(locked[18][4], TETROMINOES.O.color);
    assert.strictEqual(locked[18][5], TETROMINOES.O.color);
    assert.strictEqual(locked[19][4], TETROMINOES.O.color);
    assert.strictEqual(locked[19][5], TETROMINOES.O.color);
  });

  test('detects and clears full lines correctly', () => {
    const board = createEmptyBoard();

    // Fill row 19 completely except 1 cell
    for (let c = 0; c < BOARD_WIDTH - 1; c++) {
      board[19][c] = '#FF0000';
    }
    const noClear = clearFullLines(board);
    assert.strictEqual(noClear.linesCleared, 0);

    // Complete the line
    board[19][BOARD_WIDTH - 1] = '#FF0000';
    const clearOne = clearFullLines(board);
    assert.strictEqual(clearOne.linesCleared, 1);
    assert.strictEqual(clearOne.clearedBoard.length, BOARD_HEIGHT);
    // Row 19 should now be empty after clearing
    assert.ok(clearOne.clearedBoard[19].every(c => c === null));
  });

  test('calculates score based on lines cleared and level', () => {
    assert.strictEqual(calculateScore(0, 1), 0);
    assert.strictEqual(calculateScore(1, 1), 200); // 100 * (1 + 1)
    assert.strictEqual(calculateScore(4, 1), 1600); // 800 * (1 + 1) [Tetris]
  });
});

describe('W11: Rowz Connect 4 Pure Logic Engine', () => {
  test('initializes empty 7x6 board', () => {
    const board = createEmptyRowzBoard();
    assert.strictEqual(board.length, ROWZ_ROWS);
    assert.strictEqual(board[0].length, ROWZ_COLS);
    assert.ok(board.every(r => r.every(c => c === null)));
  });

  test('handles vertical gravity drops and column limits', () => {
    let board = createEmptyRowzBoard();

    // Drop first disc into column 3 -> lands at row 5 (bottom)
    assert.strictEqual(canDropInColumn(board, 3), true);
    const drop1 = dropDisc(board, 3, 'Y');
    assert.ok(drop1);
    assert.strictEqual(drop1.row, 5);
    board = drop1.newBoard;

    // Drop second disc into column 3 -> lands at row 4
    const drop2 = dropDisc(board, 3, 'R');
    assert.ok(drop2);
    assert.strictEqual(drop2.row, 4);
    board = drop2.newBoard;

    // Fill column 3 to top
    for (let i = 0; i < 4; i++) {
      const d = dropDisc(board, 3, 'Y');
      assert.ok(d);
      board = d.newBoard;
    }

    // Column 3 is now full
    assert.strictEqual(canDropInColumn(board, 3), false);
    assert.strictEqual(dropDisc(board, 3, 'Y'), null);
  });

  test('detects horizontal 4-in-a-row win', () => {
    let board = createEmptyRowzBoard();
    board[5][0] = 'Y';
    board[5][1] = 'Y';
    board[5][2] = 'Y';
    board[5][3] = 'Y';

    const win = checkRowzWinner(board);
    assert.ok(win);
    assert.strictEqual(win.winner, 'Y');
    assert.strictEqual(win.winningCells.length, 4);
    assert.deepStrictEqual(win.winningCells, [[5, 0], [5, 1], [5, 2], [5, 3]]);
  });

  test('detects vertical 4-in-a-row win', () => {
    let board = createEmptyRowzBoard();
    board[5][2] = 'R';
    board[4][2] = 'R';
    board[3][2] = 'R';
    board[2][2] = 'R';

    const win = checkRowzWinner(board);
    assert.ok(win);
    assert.strictEqual(win.winner, 'R');
    assert.deepStrictEqual(win.winningCells, [[2, 2], [3, 2], [4, 2], [5, 2]]);
  });

  test('detects diagonal 4-in-a-row wins', () => {
    let board = createEmptyRowzBoard();
    // Diagonal down-right: (2,1), (3,2), (4,3), (5,4)
    board[2][1] = 'Y';
    board[3][2] = 'Y';
    board[4][3] = 'Y';
    board[5][4] = 'Y';

    const win = checkRowzWinner(board);
    assert.ok(win);
    assert.strictEqual(win.winner, 'Y');

    // Diagonal up-right: (5,0), (4,1), (3,2), (2,3)
    let board2 = createEmptyRowzBoard();
    board2[5][0] = 'R';
    board2[4][1] = 'R';
    board2[3][2] = 'R';
    board2[2][3] = 'R';

    const win2 = checkRowzWinner(board2);
    assert.ok(win2);
    assert.strictEqual(win2.winner, 'R');
  });

  test('CPU immediately blocks opponent winning move or seizes victory', () => {
    let board = createEmptyRowzBoard();
    // Yellow has 3 in a row at bottom: col 0, 1, 2
    board[5][0] = 'Y';
    board[5][1] = 'Y';
    board[5][2] = 'Y';

    // CPU playing 'R' must choose col 3 to block
    const blockMove = computeRowzCpuMove(board, 'Hard');
    assert.strictEqual(blockMove, 3);
  });
});

describe('W11: Offline Wisdom Datasets Integrity', () => {
  test('quotes.json exists, has 20+ quotes, and valid schema', () => {
    const quotesPath = path.join(ROOT, 'src', 'data', 'quotes.json');
    assert.strictEqual(fs.existsSync(quotesPath), true);
    const quotes = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));

    assert.ok(Array.isArray(quotes));
    assert.ok(quotes.length >= 20);

    for (const q of quotes) {
      assert.ok(q.id && typeof q.id === 'string');
      assert.ok(q.text && typeof q.text === 'string' && q.text.length > 5);
      assert.ok(q.author && typeof q.author === 'string');
      assert.ok(q.topic && typeof q.topic === 'string');
    }
  });

  test('quran.json exists, has curated verses with Arabic and translation', () => {
    const quranPath = path.join(ROOT, 'src', 'data', 'quran.json');
    assert.strictEqual(fs.existsSync(quranPath), true);
    const verses = JSON.parse(fs.readFileSync(quranPath, 'utf8'));

    assert.ok(Array.isArray(verses));
    assert.ok(verses.length >= 10);

    for (const v of verses) {
      assert.ok(v.id && typeof v.id === 'string');
      assert.ok(v.surahName && typeof v.surahName === 'string');
      assert.ok(v.arabic && typeof v.arabic === 'string');
      assert.ok(v.translation && typeof v.translation === 'string');
      assert.ok(v.reflection && typeof v.reflection === 'string');
    }
  });
});

describe('W11: System Monitor Memory Service', () => {
  test('systemMonitor module provides safe, valid memory statistics', async () => {
    const systemMonitorPath = path.join(ROOT, 'electron', 'systemMonitor.cjs');
    assert.strictEqual(fs.existsSync(systemMonitorPath), true);

    const { getMemoryStats } = await import(pathToFileURL(systemMonitorPath).href);
    const stats = await getMemoryStats();

    assert.ok(stats);
    assert.ok(typeof stats.totalBytes === 'number' && stats.totalBytes > 0);
    assert.ok(typeof stats.usedBytes === 'number' && stats.usedBytes > 0);
    assert.ok(typeof stats.freeBytes === 'number');
    assert.ok(typeof stats.usedPercent === 'number' && stats.usedPercent >= 0 && stats.usedPercent <= 100);
    assert.ok(typeof stats.totalFormatted === 'string');
    assert.ok(typeof stats.usedFormatted === 'string');
    assert.ok(Array.isArray(stats.topProcesses));
    assert.ok(stats.topProcesses.length > 0);
  });
});
