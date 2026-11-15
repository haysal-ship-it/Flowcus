/**
 * Blockz Pure Tetris Engine
 * Implements standard 10x20 matrix, 7 Tetromino shapes, rotation, collision,
 * line clears, ghost drop projection, and score progression.
 */

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface TetrominoShape {
  type: TetrominoType;
  color: string;
  rotations: number[][][]; // 4 rotations of 2D binary masks
}

export const TETROMINOES: Record<TetrominoType, TetrominoShape> = {
  I: {
    type: 'I',
    color: '#06B6D4', // Cyan
    rotations: [
      [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
      [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
      [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    ],
  },
  O: {
    type: 'O',
    color: '#EAB308', // Yellow
    rotations: [
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
    ],
  },
  T: {
    type: 'T',
    color: '#A855F7', // Purple
    rotations: [
      [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
    ],
  },
  S: {
    type: 'S',
    color: '#22C55E', // Green
    rotations: [
      [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
      [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
      [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
    ],
  },
  Z: {
    type: 'Z',
    color: '#EF4444', // Red
    rotations: [
      [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
      [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
    ],
  },
  J: {
    type: 'J',
    color: '#3B82F6', // Blue
    rotations: [
      [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
      [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
    ],
  },
  L: {
    type: 'L',
    color: '#F97316', // Orange
    rotations: [
      [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
      [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
      [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
    ],
  },
};

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function getRandomTetromino(): TetrominoType {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return types[Math.floor(Math.random() * types.length)];
}

export function canPlacePiece(
  board: (string | null)[][],
  type: TetrominoType,
  rotation: number,
  posX: number,
  posY: number
): boolean {
  const shape = TETROMINOES[type].rotations[rotation % 4];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const targetX = posX + c;
        const targetY = posY + r;

        // Wall & floor bounds
        if (targetX < 0 || targetX >= BOARD_WIDTH || targetY >= BOARD_HEIGHT) {
          return false;
        }

        // Above ceiling is allowed during spawn
        if (targetY < 0) continue;

        // Collision with existing locked block
        if (board[targetY][targetX] !== null) {
          return false;
        }
      }
    }
  }
  return true;
}

export function lockPiece(
  board: (string | null)[][],
  type: TetrominoType,
  rotation: number,
  posX: number,
  posY: number
): (string | null)[][] {
  const newBoard = board.map(row => [...row]);
  const shape = TETROMINOES[type].rotations[rotation % 4];
  const color = TETROMINOES[type].color;

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const targetY = posY + r;
        const targetX = posX + c;
        if (targetY >= 0 && targetY < BOARD_HEIGHT && targetX >= 0 && targetX < BOARD_WIDTH) {
          newBoard[targetY][targetX] = color;
        }
      }
    }
  }
  return newBoard;
}

export function clearFullLines(board: (string | null)[][]): {
  clearedBoard: (string | null)[][];
  linesCleared: number;
} {
  const remainingRows = board.filter(row => row.some(cell => cell === null));
  const linesCleared = BOARD_HEIGHT - remainingRows.length;
  const newEmptyRows = Array.from({ length: linesCleared }, () => Array(BOARD_WIDTH).fill(null));

  return {
    clearedBoard: [...newEmptyRows, ...remainingRows],
    linesCleared,
  };
}

export function getGhostY(
  board: (string | null)[][],
  type: TetrominoType,
  rotation: number,
  posX: number,
  posY: number
): number {
  let ghostY = posY;
  while (canPlacePiece(board, type, rotation, posX, ghostY + 1)) {
    ghostY++;
  }
  return ghostY;
}

export function calculateScore(linesCleared: number, level: number): number {
  const linePoints = [0, 100, 300, 500, 800];
  return (linePoints[linesCleared] || 0) * (level + 1);
}
