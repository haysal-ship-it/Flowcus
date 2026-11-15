/**
 * Rowz Pure Connect 4 Logic Engine
 * Standard 7 columns x 6 rows vertical gravity grid.
 * Provides drop validation, 4-in-a-row win detection (horizontal, vertical, diagonal),
 * winning line coordinate extraction, and Minimax AI with alpha-beta pruning.
 */

export const ROWZ_COLS = 7;
export const ROWZ_ROWS = 6;

export type RowzPlayer = 'Y' | 'R'; // 'Y' = Yellow, 'R' = Red
export type RowzCell = RowzPlayer | null;
export type RowzBoard = RowzCell[][]; // board[row][col], row 0 is top, row 5 is bottom

export interface RowzWinResult {
  winner: RowzPlayer;
  winningCells: [number, number][]; // [ [row, col], ... ] (4 cells)
}

export function createEmptyRowzBoard(): RowzBoard {
  return Array.from({ length: ROWZ_ROWS }, () => Array(ROWZ_COLS).fill(null));
}

export function canDropInColumn(board: RowzBoard, col: number): boolean {
  if (col < 0 || col >= ROWZ_COLS) return false;
  return board[0][col] === null;
}

export function getDropRow(board: RowzBoard, col: number): number {
  for (let r = ROWZ_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      return r;
    }
  }
  return -1;
}

export function dropDisc(board: RowzBoard, col: number, player: RowzPlayer): {
  newBoard: RowzBoard;
  row: number;
} | null {
  const row = getDropRow(board, col);
  if (row === -1) return null;

  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = player;
  return { newBoard, row };
}

export function isRowzBoardFull(board: RowzBoard): boolean {
  return board[0].every(cell => cell !== null);
}

export function checkRowzWinner(board: RowzBoard): RowzWinResult | null {
  // Horizontal check
  for (let r = 0; r < ROWZ_ROWS; r++) {
    for (let c = 0; c <= ROWZ_COLS - 4; c++) {
      const p = board[r][c];
      if (
        p &&
        p === board[r][c + 1] &&
        p === board[r][c + 2] &&
        p === board[r][c + 3]
      ) {
        return {
          winner: p,
          winningCells: [
            [r, c],
            [r, c + 1],
            [r, c + 2],
            [r, c + 3],
          ],
        };
      }
    }
  }

  // Vertical check
  for (let r = 0; r <= ROWZ_ROWS - 4; r++) {
    for (let c = 0; c < ROWZ_COLS; c++) {
      const p = board[r][c];
      if (
        p &&
        p === board[r + 1][c] &&
        p === board[r + 2][c] &&
        p === board[r + 3][c]
      ) {
        return {
          winner: p,
          winningCells: [
            [r, c],
            [r + 1, c],
            [r + 2, c],
            [r + 3, c],
          ],
        };
      }
    }
  }

  // Diagonal (Down-Right)
  for (let r = 0; r <= ROWZ_ROWS - 4; r++) {
    for (let c = 0; c <= ROWZ_COLS - 4; c++) {
      const p = board[r][c];
      if (
        p &&
        p === board[r + 1][c + 1] &&
        p === board[r + 2][c + 2] &&
        p === board[r + 3][c + 3]
      ) {
        return {
          winner: p,
          winningCells: [
            [r, c],
            [r + 1, c + 1],
            [r + 2, c + 2],
            [r + 3, c + 3],
          ],
        };
      }
    }
  }

  // Diagonal (Up-Right)
  for (let r = 3; r < ROWZ_ROWS; r++) {
    for (let c = 0; c <= ROWZ_COLS - 4; c++) {
      const p = board[r][c];
      if (
        p &&
        p === board[r - 1][c + 1] &&
        p === board[r - 2][c + 2] &&
        p === board[r - 3][c + 3]
      ) {
        return {
          winner: p,
          winningCells: [
            [r, c],
            [r - 1, c + 1],
            [r - 2, c + 2],
            [r - 3, c + 3],
          ],
        };
      }
    }
  }

  return null;
}

// Evaluate a window of 4 cells for scoring
function evaluateWindow(window: RowzCell[], piece: RowzPlayer): number {
  let score = 0;
  const oppPiece: RowzPlayer = piece === 'Y' ? 'R' : 'Y';

  const pieceCount = window.filter(c => c === piece).length;
  const emptyCount = window.filter(c => c === null).length;
  const oppCount = window.filter(c => c === oppPiece).length;

  if (pieceCount === 4) {
    score += 1000;
  } else if (pieceCount === 3 && emptyCount === 1) {
    score += 50;
  } else if (pieceCount === 2 && emptyCount === 2) {
    score += 10;
  }

  if (oppCount === 3 && emptyCount === 1) {
    score -= 80; // heavily penalize opponent's 3-in-a-row
  }

  return score;
}

// Heuristic score for board state
export function evaluateBoardScore(board: RowzBoard, piece: RowzPlayer): number {
  let totalScore = 0;

  // Center column preference (tactical advantage in Connect 4)
  const centerCol = Math.floor(ROWZ_COLS / 2);
  let centerCount = 0;
  for (let r = 0; r < ROWZ_ROWS; r++) {
    if (board[r][centerCol] === piece) centerCount++;
  }
  totalScore += centerCount * 6;

  // Horizontal windows
  for (let r = 0; r < ROWZ_ROWS; r++) {
    for (let c = 0; c <= ROWZ_COLS - 4; c++) {
      const win = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
      totalScore += evaluateWindow(win, piece);
    }
  }

  // Vertical windows
  for (let c = 0; c < ROWZ_COLS; c++) {
    for (let r = 0; r <= ROWZ_ROWS - 4; r++) {
      const win = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
      totalScore += evaluateWindow(win, piece);
    }
  }

  // Diagonal Down-Right
  for (let r = 0; r <= ROWZ_ROWS - 4; r++) {
    for (let c = 0; c <= ROWZ_COLS - 4; c++) {
      const win = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      totalScore += evaluateWindow(win, piece);
    }
  }

  // Diagonal Up-Right
  for (let r = 3; r < ROWZ_ROWS; r++) {
    for (let c = 0; c <= ROWZ_COLS - 4; c++) {
      const win = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
      totalScore += evaluateWindow(win, piece);
    }
  }

  return totalScore;
}

// Get valid columns that can accept a drop
export function getValidColumns(board: RowzBoard): number[] {
  const valid: number[] = [];
  // Center-out ordering for faster alpha-beta cutoffs
  const preferredOrder = [3, 2, 4, 1, 5, 0, 6];
  for (const c of preferredOrder) {
    if (canDropInColumn(board, c)) {
      valid.push(c);
    }
  }
  return valid;
}

// Minimax with Alpha-Beta Pruning
function minimax(
  board: RowzBoard,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): { score: number; column: number } {
  const win = checkRowzWinner(board);
  if (win) {
    if (win.winner === 'R') return { score: 10000 + depth, column: -1 };
    if (win.winner === 'Y') return { score: -10000 - depth, column: -1 };
  }

  const validCols = getValidColumns(board);
  if (depth === 0 || validCols.length === 0) {
    return { score: evaluateBoardScore(board, 'R'), column: -1 };
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    let bestCol = validCols[0];
    for (const col of validCols) {
      const dropRes = dropDisc(board, col, 'R');
      if (!dropRes) continue;
      const evaluation = minimax(dropRes.newBoard, depth - 1, alpha, beta, false).score;
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestCol = col;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return { score: maxEval, column: bestCol };
  } else {
    let minEval = Infinity;
    let bestCol = validCols[0];
    for (const col of validCols) {
      const dropRes = dropDisc(board, col, 'Y');
      if (!dropRes) continue;
      const evaluation = minimax(dropRes.newBoard, depth - 1, alpha, beta, true).score;
      if (evaluation < minEval) {
        minEval = evaluation;
        bestCol = col;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return { score: minEval, column: bestCol };
  }
}

/**
 * Compute CPU Move based on chosen difficulty
 */
export function computeRowzCpuMove(board: RowzBoard, difficulty: 'Easy' | 'Hard'): number {
  const validCols = getValidColumns(board);
  if (validCols.length === 0) return 0;

  // 1. Immediate Win Check for CPU ('R')
  for (const c of validCols) {
    const res = dropDisc(board, c, 'R');
    if (res && checkRowzWinner(res.newBoard)) {
      return c;
    }
  }

  // 2. Immediate Block Check against Player ('Y')
  for (const c of validCols) {
    const res = dropDisc(board, c, 'Y');
    if (res && checkRowzWinner(res.newBoard)) {
      return c;
    }
  }

  // 3. Easy Mode: 60% chance smart heuristic, 40% random valid move
  if (difficulty === 'Easy') {
    if (Math.random() < 0.4) {
      return validCols[Math.floor(Math.random() * validCols.length)];
    }
    // Simple 1-ply heuristic
    let bestScore = -Infinity;
    let bestCol = validCols[0];
    for (const c of validCols) {
      const res = dropDisc(board, c, 'R');
      if (res) {
        const score = evaluateBoardScore(res.newBoard, 'R');
        if (score > bestScore) {
          bestScore = score;
          bestCol = c;
        }
      }
    }
    return bestCol;
  }

  // 4. Hard Mode: Minimax with depth 4
  const res = minimax(board, 4, -Infinity, Infinity, true);
  return res.column !== -1 ? res.column : validCols[0];
}
