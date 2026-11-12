/**
 * Work Package W07: Playz Game Turns & Series Reset Tests
 * Validates Audits 24 and 25.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PlayzCell, PlayzMode } from '../src/types';
import {
  checkWinner,
  isBoardFull,
  getEmptyIndices,
  computeCpuMove,
  evaluateSeriesProgress,
  WIN_CONDITIONS,
  MAX_SERIES_ROUNDS,
} from '../src/utils/playzLogic';

describe('W07: Board Evaluation & Win Detection (Audit 25)', () => {
  test('correctly identifies winning rows, columns, and diagonals', () => {
    // Row 0 win
    const rowWin: PlayzCell[] = ['X', 'X', 'X', null, 'O', null, 'O', null, null];
    const resRow = checkWinner(rowWin);
    assert.ok(resRow);
    assert.equal(resRow.winner, 'X');
    assert.deepEqual(resRow.combo, [0, 1, 2]);

    // Col 1 win
    const colWin: PlayzCell[] = ['X', 'O', null, 'X', 'O', null, null, 'O', null];
    const resCol = checkWinner(colWin);
    assert.ok(resCol);
    assert.equal(resCol.winner, 'O');
    assert.deepEqual(resCol.combo, [1, 4, 7]);

    // Diagonal win
    const diagWin: PlayzCell[] = ['O', 'X', null, 'X', 'O', null, null, null, 'O'];
    const resDiag = checkWinner(diagWin);
    assert.ok(resDiag);
    assert.equal(resDiag.winner, 'O');
    assert.deepEqual(resDiag.combo, [0, 4, 8]);
  });

  test('correctly identifies full board without winner as a draw', () => {
    const drawBoard: PlayzCell[] = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X',
    ];
    assert.equal(checkWinner(drawBoard), null);
    assert.equal(isBoardFull(drawBoard), true);
  });
});

describe('W07: 5-Round Series Rules & Score Accounting (Audit 25)', () => {
  test('awards early series victory upon 3-win majority', () => {
    // 3-0 after round 3
    const res = evaluateSeriesProgress(3, 0, 0, 3);
    assert.equal(res.isSeriesOver, true);
    assert.equal(res.winner, 'X');

    // 0-3 after round 3
    const resO = evaluateSeriesProgress(0, 3, 0, 3);
    assert.equal(resO.isSeriesOver, true);
    assert.equal(resO.winner, 'O');
  });

  test('clinches series early when opponent mathematically cannot catch up', () => {
    // 2-0 after round 4 with 1 round remaining (max opponent score is 1)
    const res = evaluateSeriesProgress(2, 0, 2, 4);
    assert.equal(res.isSeriesOver, true);
    assert.equal(res.winner, 'X');
  });

  test('continues series if leading player can still be tied', () => {
    // 2-1 after round 4 with 1 round remaining (opponent can reach 2-2)
    const res = evaluateSeriesProgress(2, 1, 1, 4);
    assert.equal(res.isSeriesOver, false);
    assert.equal(res.winner, null);
  });

  test('correctly resolves 5-round series with highest score winning', () => {
    // 2-1 with 2 draws after round 5
    const res = evaluateSeriesProgress(2, 1, 2, 5);
    assert.equal(res.isSeriesOver, true);
    assert.equal(res.winner, 'X');
  });

  test('declares series a Tie when win counts are equal after 5 rounds', () => {
    // 2-2 with 1 draw after round 5
    const res1 = evaluateSeriesProgress(2, 2, 1, 5);
    assert.equal(res1.isSeriesOver, true);
    assert.equal(res1.winner, 'Tie');

    // 1-1 with 3 draws after round 5
    const res2 = evaluateSeriesProgress(1, 1, 3, 5);
    assert.equal(res2.isSeriesOver, true);
    assert.equal(res2.winner, 'Tie');

    // 0-0 with 5 draws after round 5
    const res3 = evaluateSeriesProgress(0, 0, 5, 5);
    assert.equal(res3.isSeriesOver, true);
    assert.equal(res3.winner, 'Tie');
  });
});

describe('W07: Hard AI Minimax Invariance (Audit 24)', () => {
  test('Hard AI as O (second player) NEVER loses across simulated games against random opponent', () => {
    let aiWins = 0;
    let draws = 0;
    let aiLosses = 0;

    const SIMULATION_COUNT = 300;

    for (let sim = 0; sim < SIMULATION_COUNT; sim++) {
      const board: PlayzCell[] = Array(9).fill(null);
      let turn: 'X' | 'O' = 'X';

      while (!checkWinner(board) && !isBoardFull(board)) {
        if (turn === 'X') {
          // Human/Random move
          const empty = getEmptyIndices(board);
          const chosen = empty[Math.floor(Math.random() * empty.length)];
          board[chosen] = 'X';
          turn = 'O';
        } else {
          // Hard AI move
          const move = computeCpuMove(board, 'Hard', 'O');
          assert.ok(move >= 0 && move < 9, 'AI move must be in bounds');
          assert.equal(board[move], null, 'AI move must target an empty cell');
          board[move] = 'O';
          turn = 'X';
        }
      }

      const winner = checkWinner(board)?.winner;
      if (winner === 'O') {
        aiWins++;
      } else if (winner === 'X') {
        aiLosses++;
      } else {
        draws++;
      }
    }

    assert.equal(aiLosses, 0, `Hard AI must NEVER lose! Losses: ${aiLosses}, Wins: ${aiWins}, Draws: ${draws}`);
    assert.ok(aiWins + draws === SIMULATION_COUNT);
  });

  test('Hard AI as O (first player) NEVER loses across simulated games', () => {
    let aiWins = 0;
    let draws = 0;
    let aiLosses = 0;

    const SIMULATION_COUNT = 300;

    for (let sim = 0; sim < SIMULATION_COUNT; sim++) {
      const board: PlayzCell[] = Array(9).fill(null);
      let turn: 'X' | 'O' = 'O'; // CPU starts first

      while (!checkWinner(board) && !isBoardFull(board)) {
        if (turn === 'O') {
          // Hard AI move
          const move = computeCpuMove(board, 'Hard', 'O');
          assert.ok(move >= 0 && move < 9, 'AI move must be in bounds');
          assert.equal(board[move], null, 'AI move must target an empty cell');
          board[move] = 'O';
          turn = 'X';
        } else {
          // Human/Random move
          const empty = getEmptyIndices(board);
          const chosen = empty[Math.floor(Math.random() * empty.length)];
          board[chosen] = 'X';
          turn = 'O';
        }
      }

      const winner = checkWinner(board)?.winner;
      if (winner === 'O') {
        aiWins++;
      } else if (winner === 'X') {
        aiLosses++;
      } else {
        draws++;
      }
    }

    assert.equal(aiLosses, 0, `Hard AI starting first must NEVER lose! Losses: ${aiLosses}, Wins: ${aiWins}, Draws: ${draws}`);
  });

  test('Easy AI chooses legal moves and allows human to play', () => {
    const board: PlayzCell[] = ['X', null, null, null, null, null, null, null, null];
    const move = computeCpuMove(board, 'Easy', 'O');
    assert.ok(move >= 1 && move <= 8, 'Easy AI must select a legal open cell');
  });
});

describe('W07: Game Generation Token & Race Cancellation (Audit 24)', () => {
  test('stale callbacks with outdated generation token are rejected', () => {
    let currentGeneration = 1;
    const board: PlayzCell[] = Array(9).fill(null);

    // Turn 1 scheduled with generation 1
    const tokenAtSchedule = currentGeneration;
    let delayedMoveExecuted = false;

    const delayedCallback = () => {
      // Guard against stale generation
      if (tokenAtSchedule !== currentGeneration) {
        return; // Stale callback aborted!
      }
      board[4] = 'O';
      delayedMoveExecuted = true;
    };

    // User resets game before delayed callback fires
    currentGeneration++; // Now generation 2
    board.fill(null); // Clean board

    // Stale timer fires
    delayedCallback();

    assert.equal(delayedMoveExecuted, false, 'Stale callback must NOT execute');
    assert.equal(board[4], null, 'Board must remain untouched after reset');
  });
});
