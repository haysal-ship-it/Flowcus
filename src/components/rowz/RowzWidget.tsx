import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WidgetChrome } from '../common/WidgetChrome';
import { uwidgetsAudio } from '../../utils/uwidgetsAudio';
import {
  ROWZ_COLS,
  ROWZ_ROWS,
  RowzBoard,
  RowzPlayer,
  RowzWinResult,
  createEmptyRowzBoard,
  canDropInColumn,
  dropDisc,
  checkRowzWinner,
  isRowzBoardFull,
  computeRowzCpuMove,
} from './rowzLogic';

export interface RowzWidgetProps {
  isPreview?: boolean;
}

type RowzMode = 'Easy' | 'Hard' | '2P';

export const RowzWidget: React.FC<RowzWidgetProps> = ({ isPreview = false }) => {
  const [board, setBoard] = useState<RowzBoard>(createEmptyRowzBoard);
  const [history, setHistory] = useState<RowzBoard[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<RowzPlayer>('Y');
  const [mode, setMode] = useState<RowzMode>('Hard');
  const [winResult, setWinResult] = useState<RowzWinResult | null>(null);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [isCpuThinking, setIsCpuThinking] = useState<boolean>(false);
  const [scoreY, setScoreY] = useState<number>(0);
  const [scoreR, setScoreR] = useState<number>(0);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // Monotonic generation token to invalidate CPU callbacks on reset/mode change
  const genRef = useRef<number>(0);
  const cpuTimerRef = useRef<any>(null);

  const isGameOver = winResult !== null || isDraw;

  // Cleanup CPU timers
  const clearCpuTimer = useCallback(() => {
    genRef.current++;
    if (cpuTimerRef.current) {
      clearTimeout(cpuTimerRef.current);
      cpuTimerRef.current = null;
    }
  }, []);

  // Handle column drop by human player
  const handleColumnClick = useCallback(
    (col: number) => {
      if (isPreview || isGameOver || isCpuThinking) return;
      if (!canDropInColumn(board, col)) return;

      const res = dropDisc(board, col, currentPlayer);
      if (!res) return;

      uwidgetsAudio.playTileClick();
      setHistory(prev => [...prev, board]);
      setBoard(res.newBoard);

      const win = checkRowzWinner(res.newBoard);
      if (win) {
        setWinResult(win);
        if (win.winner === 'Y') {
          setScoreY(s => s + 1);
          uwidgetsAudio.playWinFanfare();
        } else {
          setScoreR(s => s + 1);
        }
        return;
      }

      if (isRowzBoardFull(res.newBoard)) {
        setIsDraw(true);
        return;
      }

      // Switch turn
      const nextPlayer: RowzPlayer = currentPlayer === 'Y' ? 'R' : 'Y';
      setCurrentPlayer(nextPlayer);

      // Trigger CPU move if single-player mode
      if (mode !== '2P' && nextPlayer === 'R') {
        setIsCpuThinking(true);
        const thisGen = genRef.current;

        cpuTimerRef.current = setTimeout(() => {
          if (thisGen !== genRef.current) return;

          const cpuCol = computeRowzCpuMove(res.newBoard, mode);
          const cpuRes = dropDisc(res.newBoard, cpuCol, 'R');

          if (cpuRes) {
            uwidgetsAudio.playTileClick(true);
            setHistory(prev => [...prev, res.newBoard]);
            setBoard(cpuRes.newBoard);

            const cpuWin = checkRowzWinner(cpuRes.newBoard);
            if (cpuWin) {
              setWinResult(cpuWin);
              setScoreR(s => s + 1);
            } else if (isRowzBoardFull(cpuRes.newBoard)) {
              setIsDraw(true);
            } else {
              setCurrentPlayer('Y');
            }
          }
          setIsCpuThinking(false);
        }, 550);
      }
    },
    [board, currentPlayer, isCpuThinking, isGameOver, isPreview, mode]
  );

  // Undo move
  const handleUndo = useCallback(() => {
    if (isPreview || isCpuThinking || history.length === 0) return;
    clearCpuTimer();

    // If vs CPU, undo 2 steps (CPU + Player); if 2P, undo 1 step
    const stepsToUndo = mode !== '2P' && history.length >= 2 ? 2 : 1;
    const targetIndex = history.length - stepsToUndo;
    const previousBoard = targetIndex >= 0 ? history[targetIndex] : createEmptyRowzBoard();

    setBoard(previousBoard);
    setHistory(prev => prev.slice(0, targetIndex));
    setWinResult(null);
    setIsDraw(false);
    setCurrentPlayer('Y');
  }, [clearCpuTimer, history, isCpuThinking, isPreview, mode]);

  // Start new match
  const handleNewMatch = useCallback(() => {
    clearCpuTimer();
    setBoard(createEmptyRowzBoard());
    setHistory([]);
    setWinResult(null);
    setIsDraw(false);
    setIsCpuThinking(false);
    setCurrentPlayer('Y');
  }, [clearCpuTimer]);

  // Change mode
  const handleModeChange = useCallback(
    (newMode: RowzMode) => {
      setMode(newMode);
      handleNewMatch();
    },
    [handleNewMatch]
  );

  // Reset all
  const handleResetScores = useCallback(() => {
    setScoreY(0);
    setScoreR(0);
    handleNewMatch();
  }, [handleNewMatch]);

  useEffect(() => {
    return () => {
      clearCpuTimer();
    };
  }, [clearCpuTimer]);

  // Helper to check if a cell is part of the winning four
  const isWinningCell = (r: number, c: number) => {
    if (!winResult) return false;
    return winResult.winningCells.some(([wr, wc]) => wr === r && wc === c);
  };

  return (
    <div className="relative flex flex-col h-full select-none">
      <WidgetChrome title="Rowz" tag="4-in-a-Row Strategy" widgetId="rowz" />

      {/* Surface 1: Mode & Scoreboard (Symmetric Card Top) */}
      <section className="uwidget-card-top p-3 flex flex-col justify-between shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <h2 className="text-xs font-semibold text-white tracking-wide">Rowz Match</h2>
            <p className="text-[11px] text-[#797979]">
              {mode === '2P' ? 'Two Players (Local)' : `Solo vs CPU (${mode})`}
            </p>
          </div>

          {/* Mode Selector */}
          <div className="bg-[#111113] border border-white/5 rounded-full p-0.5 flex items-center">
            <button
              onClick={() => handleModeChange('Easy')}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${
                mode === 'Easy' ? 'bg-[#FACC15] text-black font-semibold' : 'text-[#797979] hover:text-white'
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => handleModeChange('Hard')}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${
                mode === 'Hard' ? 'bg-[#FACC15] text-black font-semibold' : 'text-[#797979] hover:text-white'
              }`}
            >
              Hard
            </button>
            <button
              onClick={() => handleModeChange('2P')}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${
                mode === '2P' ? 'bg-[#FACC15] text-black font-semibold' : 'text-[#797979] hover:text-white'
              }`}
            >
              2P
            </button>
          </div>
        </div>

        {/* Scoreboard Cards */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {/* Player Yellow Card */}
          <div
            className={`p-2 rounded-lg border flex items-center justify-between transition ${
              currentPlayer === 'Y' && !isGameOver
                ? 'bg-[#181A20] border-[#FACC15]/40 shadow-[0_0_8px_rgba(250,204,21,0.15)]'
                : 'bg-[#111113] border-white/5'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FACC15] shadow-[0_0_6px_#FACC15] shrink-0 inline-block" />
              <div>
                <span className="text-[10px] font-semibold text-white block leading-tight">
                  {mode === '2P' ? 'Player 1' : 'You'}
                </span>
                <span className="text-[9px] text-[#797979] leading-tight">Yellow</span>
              </div>
            </div>
            <span className="font-mono text-base font-bold text-white">{scoreY}</span>
          </div>

          {/* Player Red / CPU Card */}
          <div
            className={`p-2 rounded-lg border flex items-center justify-between transition ${
              currentPlayer === 'R' && !isGameOver
                ? 'bg-[#181A20] border-[#EF4444]/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                : 'bg-[#111113] border-white/5'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444] shrink-0 inline-block" />
              <div>
                <span className="text-[10px] font-semibold text-white block leading-tight">
                  {mode === '2P' ? 'Player 2' : 'CPU'}
                </span>
                <span className="text-[9px] text-[#797979] leading-tight">Red</span>
              </div>
            </div>
            <span className="font-mono text-base font-bold text-white">{scoreR}</span>
          </div>
        </div>
      </section>

      {/* Surface 2: 7x6 Matrix & Action Area (Symmetric Card Bottom) */}
      <section className="uwidget-card-bottom p-2.5 flex flex-col flex-1 justify-between overflow-hidden">
        {/* Status / Turn Alert */}
        <div className="flex items-center justify-between px-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            {winResult ? (
              <span className="text-xs font-bold text-[#FACC15] flex items-center gap-1">
                🏆 {winResult.winner === 'Y' ? (mode === '2P' ? 'Player 1' : 'You') : (mode === '2P' ? 'Player 2' : 'CPU')} Wins!
              </span>
            ) : isDraw ? (
              <span className="text-xs font-bold text-neutral-300">⚖ It's a Draw!</span>
            ) : isCpuThinking ? (
              <span className="text-xs text-[#EF4444] flex items-center gap-1 animate-pulse">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                CPU is computing move...
              </span>
            ) : (
              <span className="text-xs text-[#797979] flex items-center gap-1">
                Turn:{' '}
                <strong className={currentPlayer === 'Y' ? 'text-[#FACC15]' : 'text-[#EF4444]'}>
                  {currentPlayer === 'Y' ? (mode === '2P' ? 'Player 1 (Yellow)' : 'Your Turn') : (mode === '2P' ? 'Player 2 (Red)' : 'CPU Turn')}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={history.length === 0 || isCpuThinking || isGameOver}
              className="text-[10px] text-[#797979] hover:text-white disabled:opacity-30 disabled:pointer-events-none px-1.5 py-0.5 rounded bg-[#16181C] border border-white/5 transition"
              title="Undo Move"
            >
              ↶ Undo
            </button>
          </div>
        </div>

        {/* 7x6 Board Container */}
        <div className="flex flex-col items-center">
          {/* Top Column Drop Indicators */}
          <div className="grid grid-cols-7 gap-1 w-full max-w-[266px] mb-1 px-1">
            {Array.from({ length: ROWZ_COLS }).map((_, c) => {
              const canDrop = canDropInColumn(board, c) && !isGameOver && !isCpuThinking;
              const isHovered = hoverCol === c;

              return (
                <button
                  key={c}
                  onClick={() => handleColumnClick(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  onMouseLeave={() => setHoverCol(null)}
                  disabled={!canDrop}
                  className={`h-5 rounded flex items-center justify-center text-xs transition-all ${
                    canDrop && isHovered
                      ? currentPlayer === 'Y'
                        ? 'text-[#FACC15] bg-[#FACC15]/20 scale-105'
                        : 'text-[#EF4444] bg-[#EF4444]/20 scale-105'
                      : canDrop
                      ? 'text-[#797979] hover:text-white bg-transparent'
                      : 'opacity-10 cursor-not-allowed'
                  }`}
                  title={`Drop disc in column ${c + 1}`}
                >
                  ▼
                </button>
              );
            })}
          </div>

          {/* Grid Box */}
          <div className="bg-[#0B132B] p-2 rounded-xl border border-white/10 shadow-lg w-full max-w-[266px]">
            <div className="grid grid-cols-7 gap-1.5">
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isWin = isWinningCell(r, c);
                  const isHoveringThisCol = hoverCol === c && !isGameOver && !isCpuThinking;

                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => handleColumnClick(c)}
                      onMouseEnter={() => setHoverCol(c)}
                      onMouseLeave={() => setHoverCol(null)}
                      disabled={!canDropInColumn(board, c) || isGameOver || isCpuThinking}
                      className="aspect-square rounded-full flex items-center justify-center relative focus:outline-none transition-transform"
                    >
                      {/* Recessed Socket Hole */}
                      <div className="w-full h-full rounded-full bg-[#050814] shadow-inner border border-white/5 flex items-center justify-center p-0.5">
                        {cell === 'Y' && (
                          <div
                            className={`w-full h-full rounded-full bg-gradient-to-br from-[#FDE047] via-[#FACC15] to-[#CA8A04] shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                              isWin
                                ? 'ring-2 ring-white shadow-[0_0_12px_#FACC15] animate-pulse'
                                : ''
                            }`}
                          />
                        )}
                        {cell === 'R' && (
                          <div
                            className={`w-full h-full rounded-full bg-gradient-to-br from-[#F87171] via-[#EF4444] to-[#B91C1C] shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                              isWin
                                ? 'ring-2 ring-white shadow-[0_0_12px_#EF4444] animate-pulse'
                                : ''
                            }`}
                          />
                        )}
                        {cell === null && isHoveringThisCol && (
                          <div className="w-2 h-2 rounded-full bg-white/10 transition-opacity" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center gap-2 pt-2 mt-auto">
          <button
            onClick={handleNewMatch}
            className="flex-1 bg-white hover:bg-neutral-200 text-black font-semibold text-xs py-2 rounded-full transition shadow flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            {isGameOver ? '▶ Play Again' : '↺ Reset Board'}
          </button>
          <button
            onClick={handleResetScores}
            className="w-8 h-8 rounded-full bg-[#181A1E] border border-white/10 flex items-center justify-center text-xs text-[#797979] hover:text-white hover:bg-white/10 transition"
            title="Reset Scores to 0-0"
          >
            ★
          </button>
        </div>
      </section>
    </div>
  );
};
