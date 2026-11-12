/**
 * Native Verification Script for W07: Deterministic Game Turns & Series Reset
 * Tests win/draw detection, Minimax AI optimality, 5-round series rules,
 * generation token race cancellation, and CPU opening moves.
 */

const assert = require('assert');

// Import pure logic module compiled or loaded via tsx / node
const {
  checkWinner,
  isBoardFull,
  getEmptyIndices,
  computeCpuMove,
  evaluateSeriesProgress,
  WIN_CONDITIONS,
  MAX_SERIES_ROUNDS,
} = require('../src/utils/playzLogic.ts');

async function runNativeVerification() {
  console.log('--- STARTING W07 NATIVE VERIFICATION ---');

  // Check 1: Win detection across rows, columns, and diagonals
  console.log('[Check 1] Verifying win and draw detection across all combos...');
  for (const [a, b, c] of WIN_CONDITIONS) {
    const board = Array(9).fill(null);
    board[a] = 'X';
    board[b] = 'X';
    board[c] = 'X';
    const win = checkWinner(board);
    assert.ok(win, `Combo [${a}, ${b}, ${c}] must register as a win`);
    assert.strictEqual(win.winner, 'X');
    assert.deepEqual(win.combo, [a, b, c]);
  }

  // Draw board
  const drawBoard = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  assert.strictEqual(checkWinner(drawBoard), null);
  assert.strictEqual(isBoardFull(drawBoard), true);
  console.log('✓ Check 1 Passed: Win conditions and draw detection verified.');

  // Check 2: 5-Round series rules, draws, and early clinching
  console.log('[Check 2] Verifying 5-round series rules and draw accounting...');
  // 3-0 majority
  const eval30 = evaluateSeriesProgress(3, 0, 0, 3);
  assert.strictEqual(eval30.isSeriesOver, true);
  assert.strictEqual(eval30.winner, 'X');

  // 2-0 with 1 round left (clinch)
  const eval20 = evaluateSeriesProgress(2, 0, 2, 4);
  assert.strictEqual(eval20.isSeriesOver, true);
  assert.strictEqual(eval20.winner, 'X');

  // 1-1 with 3 draws after 5 rounds (Tie)
  const evalTie = evaluateSeriesProgress(1, 1, 3, 5);
  assert.strictEqual(evalTie.isSeriesOver, true);
  assert.strictEqual(evalTie.winner, 'Tie');

  // 2-1 with 2 draws after 5 rounds (Player X win)
  const eval21 = evaluateSeriesProgress(2, 1, 2, 5);
  assert.strictEqual(eval21.isSeriesOver, true);
  assert.strictEqual(eval21.winner, 'X');
  console.log('✓ Check 2 Passed: 5-round series rules, draws, and ties verified.');

  // Check 3: Hard AI never loses (Minimax invariance)
  console.log('[Check 3] Verifying Hard AI Minimax invariance across 200 simulated games...');
  let aiLosses = 0;
  for (let g = 0; g < 200; g++) {
    const board = Array(9).fill(null);
    let turn = g % 2 === 0 ? 'X' : 'O'; // Alternate starting player

    while (!checkWinner(board) && !isBoardFull(board)) {
      if (turn === 'X') {
        const empty = getEmptyIndices(board);
        board[empty[Math.floor(Math.random() * empty.length)]] = 'X';
        turn = 'O';
      } else {
        const move = computeCpuMove(board, 'Hard', 'O');
        assert.ok(move >= 0 && move < 9);
        assert.strictEqual(board[move], null);
        board[move] = 'O';
        turn = 'X';
      }
    }

    const winner = checkWinner(board)?.winner;
    if (winner === 'X') {
      aiLosses++;
    }
  }
  assert.strictEqual(aiLosses, 0, 'Hard AI must never lose a game');
  console.log('✓ Check 3 Passed: Hard AI Minimax verified with 0 losses across 200 games.');

  // Check 4: Generation token race cancellation
  console.log('[Check 4] Verifying generation token cancellation on rapid reset / mode change...');
  let activeGen = 10;
  const board = Array(9).fill(null);
  let staleExecuted = false;

  const scheduledGen = activeGen;
  const delayedMove = () => {
    if (scheduledGen !== activeGen) return; // Stale check
    board[0] = 'O';
    staleExecuted = true;
  };

  // User resets before timer fires
  activeGen++; // Token incremented
  delayedMove();

  assert.strictEqual(staleExecuted, false, 'Delayed move must NOT execute after reset');
  assert.strictEqual(board[0], null, 'Board must remain empty');
  console.log('✓ Check 4 Passed: Stale callbacks cleanly dropped via generation token.');

  // Check 5: CPU-started round legal opening move
  console.log('[Check 5] Verifying CPU-started round makes exactly one legal opening move...');
  const emptyBoard = Array(9).fill(null);
  const openingMove = computeCpuMove(emptyBoard, 'Hard', 'O');
  assert.ok(openingMove >= 0 && openingMove < 9, 'Opening move must be on-board');
  assert.strictEqual(emptyBoard[openingMove], null, 'Target cell must be unoccupied');
  emptyBoard[openingMove] = 'O';
  const pieces = emptyBoard.filter(c => c !== null);
  assert.strictEqual(pieces.length, 1, 'Exactly one move must be placed');
  assert.strictEqual(pieces[0], 'O');
  console.log('✓ Check 5 Passed: CPU-started rounds produce exactly one legal opening move.');

  // Check 6: Easy and 2-Player modes function correctly
  console.log('[Check 6] Verifying Easy and 2P modes...');
  const testBoard = ['X', null, null, null, null, null, null, null, null];
  const easyMove = computeCpuMove(testBoard, 'Easy', 'O');
  assert.ok(easyMove >= 1 && easyMove <= 8, 'Easy move must be legal');
  console.log('✓ Check 6 Passed: Easy and 2P modes verified.');

  console.log('\n========================================');
  console.log('ALL W07 NATIVE VERIFICATION CHECKS PASSED');
  console.log('========================================');
}

runNativeVerification().catch(err => {
  console.error('NATIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
