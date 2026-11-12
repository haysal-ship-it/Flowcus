/**
 * Pure Game Rules & AI Engine for Playz Widget (W07)
 * Authoritative logic for win conditions, Minimax AI, and 5-round series rules.
 */

import { PlayzCell, PlayzMode } from '../types';

export const WIN_CONDITIONS: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6],            // Diagonals
];

export const MAX_SERIES_ROUNDS = 5;

export interface WinResult {
  winner: 'X' | 'O';
  combo: [number, number, number];
}

export interface SeriesEvaluation {
  isSeriesOver: boolean;
  winner: 'X' | 'O' | 'Tie' | null;
  reason: string;
}

/**
 * Checks whether the current board state has a 3-in-a-row winner.
 */
export function checkWinner(board: PlayzCell[]): WinResult | null {
  for (const [a, b, c] of WIN_CONDITIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], combo: [a, b, c] };
    }
  }
  return null;
}

/**
 * Checks whether all 9 cells on the board are occupied.
 */
export function isBoardFull(board: PlayzCell[]): boolean {
  return !board.includes(null);
}

/**
 * Returns all unoccupied cell indices [0..8].
 */
export function getEmptyIndices(board: PlayzCell[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) indices.push(i);
  }
  return indices;
}

/**
 * Recursive Minimax search with depth penalty for optimal AI play.
 */
export function minimax(
  board: PlayzCell[],
  depth: number,
  isMax: boolean,
  aiMark: 'X' | 'O' = 'O'
): number {
  const humanMark: 'X' | 'O' = aiMark === 'O' ? 'X' : 'O';
  const win = checkWinner(board);
  if (win) {
    return win.winner === aiMark ? 10 - depth : depth - 10;
  }
  if (isBoardFull(board)) return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiMark;
        best = Math.max(best, minimax(board, depth + 1, false, aiMark));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanMark;
        best = Math.min(best, minimax(board, depth + 1, true, aiMark));
        board[i] = null;
      }
    }
    return best;
  }
}

/**
 * Computes the next CPU move based on the selected mode.
 */
export function computeCpuMove(
  board: PlayzCell[],
  mode: PlayzMode,
  aiMark: 'X' | 'O' = 'O'
): number {
  const empty = getEmptyIndices(board);
  if (empty.length === 0) return -1;

  if (mode === 'Easy') {
    // Random move from open squares
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Hard Minimax AI
  // If opening on a completely empty board, center (4) is optimal
  if (empty.length === 9) {
    return 4;
  }

  let bestScore = -Infinity;
  let bestMove = empty[0];

  for (const idx of empty) {
    board[idx] = aiMark;
    const score = minimax(board, 0, false, aiMark);
    board[idx] = null;

    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }

  return bestMove;
}

/**
 * Evaluates 5-round series status according to approved rules:
 * - 5 total rounds maximum.
 * - Draws count as rounds.
 * - First to majority (3 wins) clinches early.
 * - Leading player clinches if opponent cannot catch up.
 * - Highest score after 5 rounds wins; equal scores result in a Tie.
 */
export function evaluateSeriesProgress(
  scoreX: number,
  scoreO: number,
  draws: number,
  currentRound: number
): SeriesEvaluation {
  // 1. Direct majority: 3 wins out of 5
  if (scoreX >= 3) {
    return {
      isSeriesOver: true,
      winner: 'X',
      reason: 'Player X achieved 3-win majority!',
    };
  }
  if (scoreO >= 3) {
    return {
      isSeriesOver: true,
      winner: 'O',
      reason: 'Opponent O achieved 3-win majority!',
    };
  }

  // 2. Completed 5 rounds
  if (currentRound >= MAX_SERIES_ROUNDS) {
    if (scoreX > scoreO) {
      return {
        isSeriesOver: true,
        winner: 'X',
        reason: `Player X won the 5-round series (${scoreX}–${scoreO})!`,
      };
    }
    if (scoreO > scoreX) {
      return {
        isSeriesOver: true,
        winner: 'O',
        reason: `Opponent O won the 5-round series (${scoreO}–${scoreX})!`,
      };
    }
    return {
      isSeriesOver: true,
      winner: 'Tie',
      reason: `5-round series ended in a tie (${scoreX}–${scoreO}, ${draws} draw${draws === 1 ? '' : 's'})!`,
    };
  }

  // 3. Mathematical clinch before round 5:
  // Remaining rounds after the currently completed round
  const remainingRounds = MAX_SERIES_ROUNDS - currentRound;
  if (scoreX > scoreO + remainingRounds) {
    return {
      isSeriesOver: true,
      winner: 'X',
      reason: `Player X clinched the series (${scoreX}–${scoreO} with ${remainingRounds} round${remainingRounds === 1 ? '' : 's'} remaining)!`,
    };
  }
  if (scoreO > scoreX + remainingRounds) {
    return {
      isSeriesOver: true,
      winner: 'O',
      reason: `Opponent O clinched the series (${scoreO}–${scoreX} with ${remainingRounds} round${remainingRounds === 1 ? '' : 's'} remaining)!`,
    };
  }

  // Series continues
  return {
    isSeriesOver: false,
    winner: null,
    reason: `Round ${currentRound} completed. Next: Round ${currentRound + 1}.`,
  };
}
