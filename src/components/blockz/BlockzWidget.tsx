import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WidgetChrome } from '../common/WidgetChrome';
import { uwidgetsAudio } from '../../utils/uwidgetsAudio';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TetrominoType,
  createEmptyBoard,
  getRandomTetromino,
  canPlacePiece,
  lockPiece,
  clearFullLines,
  getGhostY,
  calculateScore,
  TETROMINOES,
} from './blockzLogic';

export interface BlockzWidgetProps {
  isPreview?: boolean;
}

type GameMode = 'Solo' | 'Zen';
type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover';

export const BlockzWidget: React.FC<BlockzWidgetProps> = ({ isPreview = false }) => {
  const [board, setBoard] = useState<(string | null)[][]>(createEmptyBoard);
  const [currentPiece, setCurrentPiece] = useState<{
    type: TetrominoType;
    rotation: number;
    x: number;
    y: number;
  } | null>(null);
  const [nextPieceType, setNextPieceType] = useState<TetrominoType>(getRandomTetromino);
  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [mode, setMode] = useState<GameMode>('Solo');
  const [status, setStatus] = useState<GameStatus>('idle');
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('uwidgets_blockz_highscore');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const tickTimerRef = useRef<any>(null);

  const spawnNewPiece = useCallback(
    (curBoard: (string | null)[][], incomingType: TetrominoType) => {
      const spawnX = Math.floor(BOARD_WIDTH / 2) - 1;
      const spawnY = 0;

      if (!canPlacePiece(curBoard, incomingType, 0, spawnX, spawnY)) {
        // Game Over
        setStatus('gameover');
        setCurrentPiece(null);
        return false;
      }

      setCurrentPiece({
        type: incomingType,
        rotation: 0,
        x: spawnX,
        y: spawnY,
      });
      setNextPieceType(getRandomTetromino());
      return true;
    },
    []
  );

  const startNewGame = useCallback(() => {
    const empty = createEmptyBoard();
    setBoard(empty);
    setScore(0);
    setLines(0);
    setLevel(1);
    setStatus('playing');

    const firstPiece = getRandomTetromino();
    const secondPiece = getRandomTetromino();
    setNextPieceType(secondPiece);

    const spawnX = Math.floor(BOARD_WIDTH / 2) - 1;
    setCurrentPiece({
      type: firstPiece,
      rotation: 0,
      x: spawnX,
      y: 0,
    });
  }, []);

  // Move left / right
  const moveHorizontal = useCallback(
    (deltaX: number) => {
      if (status !== 'playing' || !currentPiece) return;
      if (canPlacePiece(board, currentPiece.type, currentPiece.rotation, currentPiece.x + deltaX, currentPiece.y)) {
        setCurrentPiece(prev => (prev ? { ...prev, x: prev.x + deltaX } : null));
        uwidgetsAudio.playTileClick();
      }
    },
    [board, currentPiece, status]
  );

  // Rotate piece clockwise
  const rotatePiece = useCallback(() => {
    if (status !== 'playing' || !currentPiece) return;
    const nextRot = (currentPiece.rotation + 1) % 4;

    // Normal placement or wall kick test (try current x, x-1, x+1, x-2, x+2)
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (canPlacePiece(board, currentPiece.type, nextRot, currentPiece.x + kick, currentPiece.y)) {
        setCurrentPiece(prev => (prev ? { ...prev, rotation: nextRot, x: prev.x + kick } : null));
        uwidgetsAudio.playTileClick();
        return;
      }
    }
  }, [board, currentPiece, status]);

  // Soft drop step
  const dropStep = useCallback(() => {
    if (status !== 'playing' || !currentPiece) return;

    if (canPlacePiece(board, currentPiece.type, currentPiece.rotation, currentPiece.x, currentPiece.y + 1)) {
      setCurrentPiece(prev => (prev ? { ...prev, y: prev.y + 1 } : null));
    } else {
      // Lock piece into board
      const locked = lockPiece(board, currentPiece.type, currentPiece.rotation, currentPiece.x, currentPiece.y);
      const { clearedBoard, linesCleared } = clearFullLines(locked);

      const addedScore = calculateScore(linesCleared, level) + (linesCleared > 0 ? 50 : 10);
      const newScore = score + addedScore;
      const newLines = lines + linesCleared;
      const newLevel = Math.max(1, Math.floor(newLines / 10) + 1);

      setBoard(clearedBoard);
      setScore(newScore);
      setLines(newLines);
      setLevel(newLevel);

      if (newScore > highScore) {
        setHighScore(newScore);
        try {
          localStorage.setItem('uwidgets_blockz_highscore', String(newScore));
        } catch {}
      }

      if (linesCleared > 0) {
        uwidgetsAudio.playWinFanfare();
      } else {
        uwidgetsAudio.playTileClick();
      }

      spawnNewPiece(clearedBoard, nextPieceType);
    }
  }, [board, currentPiece, highScore, level, lines, nextPieceType, score, spawnNewPiece, status]);

  // Hard drop (instantly locks to ghost position)
  const hardDrop = useCallback(() => {
    if (status !== 'playing' || !currentPiece) return;
    const ghostY = getGhostY(board, currentPiece.type, currentPiece.rotation, currentPiece.x, currentPiece.y);
    const dropDistance = ghostY - currentPiece.y;

    const locked = lockPiece(board, currentPiece.type, currentPiece.rotation, currentPiece.x, ghostY);
    const { clearedBoard, linesCleared } = clearFullLines(locked);

    const addedScore = calculateScore(linesCleared, level) + dropDistance * 2;
    const newScore = score + addedScore;
    const newLines = lines + linesCleared;
    const newLevel = Math.max(1, Math.floor(newLines / 10) + 1);

    setBoard(clearedBoard);
    setScore(newScore);
    setLines(newLines);
    setLevel(newLevel);

    if (newScore > highScore) {
      setHighScore(newScore);
      try {
        localStorage.setItem('uwidgets_blockz_highscore', String(newScore));
      } catch {}
    }

    if (linesCleared > 0) {
      uwidgetsAudio.playWinFanfare();
    } else {
      uwidgetsAudio.playTileClick();
    }

    spawnNewPiece(clearedBoard, nextPieceType);
  }, [board, currentPiece, highScore, level, lines, nextPieceType, score, spawnNewPiece, status]);

  // Game loop interval
  useEffect(() => {
    if (isPreview || status !== 'playing') {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      return;
    }

    const tickMs = mode === 'Zen' ? 850 : Math.max(120, 800 - (level - 1) * 65);
    tickTimerRef.current = setInterval(() => {
      dropStep();
    }, tickMs);

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, [dropStep, isPreview, level, mode, status]);

  // Keyboard navigation
  useEffect(() => {
    if (isPreview) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveHorizontal(-1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveHorizontal(1);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
          e.preventDefault();
          rotatePiece();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          dropStep();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
        case 'Escape':
          e.preventDefault();
          setStatus(prev => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
          break;
        case 'r':
        case 'R':
          if (status === 'gameover' || status === 'paused') {
            e.preventDefault();
            startNewGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropStep, hardDrop, isPreview, moveHorizontal, rotatePiece, startNewGame, status]);

  // Compute ghost piece coordinates
  const ghostY = currentPiece
    ? getGhostY(board, currentPiece.type, currentPiece.rotation, currentPiece.x, currentPiece.y)
    : 0;

  // Render combined matrix cell (board cell vs ghost cell vs active cell)
  const renderCell = (r: number, c: number) => {
    let cellColor: string | null = board[r][c];
    let isGhost = false;
    let isActive = false;

    if (currentPiece) {
      const shape = TETROMINOES[currentPiece.type].rotations[currentPiece.rotation % 4];
      const relR = r - currentPiece.y;
      const relC = c - currentPiece.x;

      if (relR >= 0 && relR < shape.length && relC >= 0 && relC < shape[relR].length && shape[relR][relC]) {
        cellColor = TETROMINOES[currentPiece.type].color;
        isActive = true;
      } else {
        // Check ghost piece
        const ghostRelR = r - ghostY;
        if (ghostRelR >= 0 && ghostRelR < shape.length && relC >= 0 && relC < shape[ghostRelR].length && shape[ghostRelR][relC]) {
          isGhost = true;
        }
      }
    }

    if (cellColor && !isGhost) {
      return (
        <div
          key={`${r}-${c}`}
          className="w-full aspect-square rounded-[2px] transition-all"
          style={{
            backgroundColor: cellColor,
            boxShadow: isActive ? `0 0 6px ${cellColor}80` : 'none',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        />
      );
    }

    if (isGhost) {
      return (
        <div
          key={`${r}-${c}`}
          className="w-full aspect-square rounded-[2px]"
          style={{
            border: '1px dashed rgba(255,255,255,0.3)',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        />
      );
    }

    return (
      <div
        key={`${r}-${c}`}
        className="w-full aspect-square rounded-[2px] bg-[#0E1013] border border-white/[0.03]"
      />
    );
  };

  // Render Next Piece Mini Grid (4x4)
  const renderNextPiecePreview = () => {
    const shape = TETROMINOES[nextPieceType].rotations[0];
    const color = TETROMINOES[nextPieceType].color;

    return (
      <div className="grid grid-cols-4 gap-0.5 w-[36px] h-[36px] bg-[#0C0D0F] p-1 rounded border border-white/5 items-center justify-center">
        {Array.from({ length: 16 }).map((_, idx) => {
          const r = Math.floor(idx / 4);
          const c = idx % 4;
          const isFilled = r < shape.length && c < shape[r].length && shape[r][c];

          return (
            <div
              key={idx}
              className="w-1.5 h-1.5 rounded-[1px]"
              style={{
                backgroundColor: isFilled ? color : 'transparent',
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex flex-col h-full select-none">
      <WidgetChrome title="Blockz" tag="Retro Arcade" widgetId="blockz" />

      {/* Surface 1: Score & Next Piece (Symmetric Card Top) */}
      <section className="uwidget-card-top p-3 flex flex-col justify-between shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <h2 className="text-xs font-semibold text-white tracking-wide">Blockz Marathon</h2>
            <p className="text-[11px] text-[#797979]">Classic 10×20 Gravity</p>
          </div>
          {/* Mode Pill Toggle */}
          <div className="bg-[#111113] border border-white/5 rounded-full p-0.5 flex items-center">
            <button
              onClick={() => {
                setMode('Solo');
                if (status === 'playing') startNewGame();
              }}
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition ${
                mode === 'Solo' ? 'bg-[#D05300] text-white font-semibold' : 'text-[#797979] hover:text-white'
              }`}
            >
              Solo
            </button>
            <button
              onClick={() => {
                setMode('Zen');
                if (status === 'playing') startNewGame();
              }}
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium transition ${
                mode === 'Zen' ? 'bg-[#D05300] text-white font-semibold' : 'text-[#797979] hover:text-white'
              }`}
            >
              Zen
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="flex items-center justify-between bg-[#111113] px-3 py-1.5 rounded-lg border border-white/5">
          <div className="text-left">
            <span className="text-[9px] uppercase tracking-wider text-[#797979] block">Score</span>
            <span className="font-mono text-sm font-bold text-[#D05300] leading-tight">
              {score.toLocaleString()}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[9px] uppercase tracking-wider text-[#797979] block">Lines / Lvl</span>
            <span className="font-mono text-xs font-semibold text-white leading-tight">
              {lines} <span className="text-[#797979] text-[10px]">/ L{level}</span>
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-[#797979] block mb-0.5">Next</span>
            {renderNextPiecePreview()}
          </div>
        </div>
      </section>

      {/* Surface 2: Playfield Matrix & Controls (Symmetric Card Bottom) */}
      <section className="uwidget-card-bottom p-2.5 flex flex-col flex-1 justify-between overflow-hidden">
        {/* Matrix Viewport */}
        <div
          ref={boardContainerRef}
          className="relative mx-auto bg-[#07080A] p-1 rounded-lg border border-white/10 flex items-center justify-center shadow-inner"
          style={{ width: '150px', height: '240px' }}
        >
          {/* 10x20 Grid */}
          <div
            className="grid gap-[1px] w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
              gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)`,
            }}
          >
            {board.map((row, r) => row.map((_, c) => renderCell(r, c)))}
          </div>

          {/* Overlays for Idle, Paused, GameOver */}
          {status === 'idle' && (
            <div className="absolute inset-0 bg-[#07080A]/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center rounded-lg">
              <span className="text-2xl mb-1">🎮</span>
              <span className="text-xs font-bold text-white tracking-wide">Ready to Drop</span>
              <span className="text-[10px] text-[#797979] mt-1">Arrow keys / WASD to steer, Space to drop</span>
            </div>
          )}

          {status === 'paused' && (
            <div className="absolute inset-0 bg-[#07080A]/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center rounded-lg">
              <span className="text-2xl mb-1">⏸</span>
              <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Game Paused</span>
              <span className="text-[10px] text-[#797979] mt-1">Press P or Resume to continue</span>
            </div>
          )}

          {status === 'gameover' && (
            <div className="absolute inset-0 bg-[#07080A]/90 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center rounded-lg">
              <span className="text-2xl mb-1">💥</span>
              <span className="text-xs font-bold text-red-400 tracking-wider uppercase">Game Over</span>
              <span className="font-mono text-sm font-bold text-white mt-1">{score.toLocaleString()} PTS</span>
              <span className="text-[10px] text-[#797979] mt-0.5">Best: {highScore.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* On-screen Directional Touch/Click Controls */}
        <div className="flex items-center justify-center gap-1.5 my-1">
          <button
            onClick={() => moveHorizontal(-1)}
            disabled={status !== 'playing'}
            className="w-8 h-7 rounded-md bg-[#16181C] border border-white/10 flex items-center justify-center text-xs text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition"
            title="Move Left (A / ◄)"
          >
            ◄
          </button>
          <button
            onClick={rotatePiece}
            disabled={status !== 'playing'}
            className="w-8 h-7 rounded-md bg-[#16181C] border border-white/10 flex items-center justify-center text-xs text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition font-bold"
            title="Rotate (W / ▲)"
          >
            ↻
          </button>
          <button
            onClick={() => moveHorizontal(1)}
            disabled={status !== 'playing'}
            className="w-8 h-7 rounded-md bg-[#16181C] border border-white/10 flex items-center justify-center text-xs text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition"
            title="Move Right (D / ►)"
          >
            ►
          </button>
          <button
            onClick={dropStep}
            disabled={status !== 'playing'}
            className="w-8 h-7 rounded-md bg-[#16181C] border border-white/10 flex items-center justify-center text-xs text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition"
            title="Soft Drop (S / ▼)"
          >
            ▼
          </button>
          <button
            onClick={hardDrop}
            disabled={status !== 'playing'}
            className="w-8 h-7 rounded-md bg-[#16181C] border border-[#D05300]/40 text-[#D05300] flex items-center justify-center text-xs font-bold hover:bg-[#D05300]/20 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition"
            title="Hard Drop (Space)"
          >
            ⤓
          </button>
        </div>

        {/* Primary Action Button Bar */}
        <div className="flex items-center gap-2 pt-1">
          {status === 'idle' && (
            <button
              onClick={startNewGame}
              className="flex-1 bg-white hover:bg-neutral-200 text-black font-semibold text-xs py-2 rounded-full transition shadow flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <span>▶</span> Start Marathon
            </button>
          )}

          {status === 'playing' && (
            <>
              <button
                onClick={() => setStatus('paused')}
                className="flex-1 bg-white hover:bg-neutral-200 text-black font-semibold text-xs py-2 rounded-full transition shadow flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <span>⏸</span> Pause Game
              </button>
              <button
                onClick={startNewGame}
                className="w-8 h-8 rounded-full bg-[#181A1E] border border-white/10 flex items-center justify-center text-xs text-[#797979] hover:text-white hover:bg-white/10 transition"
                title="Restart"
              >
                ↺
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={() => setStatus('playing')}
                className="flex-1 bg-white hover:bg-neutral-200 text-black font-semibold text-xs py-2 rounded-full transition shadow flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <span>▶</span> Resume Game
              </button>
              <button
                onClick={startNewGame}
                className="w-8 h-8 rounded-full bg-[#181A1E] border border-white/10 flex items-center justify-center text-xs text-[#797979] hover:text-white hover:bg-white/10 transition"
                title="Restart"
              >
                ↺
              </button>
            </>
          )}

          {status === 'gameover' && (
            <button
              onClick={startNewGame}
              className="flex-1 bg-white hover:bg-neutral-200 text-black font-semibold text-xs py-2 rounded-full transition shadow flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <span>↺</span> Play Again
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
