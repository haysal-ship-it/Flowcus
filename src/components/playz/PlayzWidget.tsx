import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayzMode, PlayzCell } from '../../types';
import { WidgetChrome } from '../common/WidgetChrome';
import { uwidgetsAudio } from '../../utils/uwidgetsAudio';
import { isReducedMotion } from '../../utils/reducedMotion';
import {
  checkWinner,
  isBoardFull,
  computeCpuMove,
  evaluateSeriesProgress,
  MAX_SERIES_ROUNDS,
  WinResult,
} from '../../utils/playzLogic';

export interface PlayzWidgetProps {
  isPreview?: boolean;
}

export const PlayzWidget: React.FC<PlayzWidgetProps> = ({ isPreview = false }) => {
  const [board, setBoard] = useState<PlayzCell[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [gameActive, setGameActive] = useState<boolean>(true);
  const [isCpuThinking, setIsCpuThinking] = useState<boolean>(false);
  const [scoreX, setScoreX] = useState<number>(0);
  const [scoreO, setScoreO] = useState<number>(0);
  const [draws, setDraws] = useState<number>(0);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [isSeriesOver, setIsSeriesOver] = useState<boolean>(false);
  const [mode, setMode] = useState<PlayzMode>('Hard');
  const [statusText, setStatusText] = useState<string>('Your Turn (X)');
  const [submessage, setSubmessage] = useState<string>('First to 3 wins or leader after 5 rounds!');
  const [brushD, setBrushD] = useState<string>('');
  const [brushColor, setBrushColor] = useState<string>('#D05300');
  const [showBrush, setShowBrush] = useState<boolean>(false);
  const [brushDrawn, setBrushDrawn] = useState<boolean>(false);
  const [brushLength, setBrushLength] = useState<number>(400);
  const [boardDims, setBoardDims] = useState<{ w: number; h: number }>({ w: 210, h: 210 });
  const [roundButtonLabel, setRoundButtonLabel] = useState<string>('Next Round');

  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Audit 24: Monotonic generation token to invalidate in-flight async callbacks on reset/mode change
  const gameGenRef = useRef<number>(0);
  const cpuTimerRef = useRef<any>(null);
  const resultTimerRef = useRef<any>(null);
  const confettiAnimRef = useRef<any>(null);
  const brushFrameRef = useRef<any>(null);

  const maxRounds = MAX_SERIES_ROUNDS;
  const totalBars = 35;
  const filledBars = Math.min(totalBars, Math.round((currentRound / maxRounds) * totalBars));

  // Centralized async handle abortion helper (Audit 24)
  const abortAllPendingAsync = useCallback(() => {
    gameGenRef.current++; // Invalidate any running timer or animation callbacks
    if (cpuTimerRef.current) {
      clearTimeout(cpuTimerRef.current);
      cpuTimerRef.current = null;
    }
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    if (confettiAnimRef.current) {
      cancelAnimationFrame(confettiAnimRef.current);
      confettiAnimRef.current = null;
    }
    if (brushFrameRef.current) {
      cancelAnimationFrame(brushFrameRef.current);
      brushFrameRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current.style.display = 'none';
    }
    setIsCpuThinking(false);
  }, []);

  // Clean up all pending timers and animations on unmount (Audit 24)
  useEffect(() => {
    return () => {
      abortAllPendingAsync();
    };
  }, [abortAllPendingAsync]);

  // --- Confetti Animation with frame handle tracking & reduced motion check ---
  const triggerConfetti = () => {
    if (!isPreview) uwidgetsAudio.playWinFanfare();
    if (isReducedMotion()) {
      return; // Respect prefers-reduced-motion: reduce
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.display = 'block';
    canvas.width = window.innerWidth || 450;
    canvas.height = window.innerHeight || 650;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#D05300', '#00C853', '#F18A42', '#FFFFFF', '#FEF08A', '#38BDF8'];
    const particles: any[] = [];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() * 80 - 40),
        y: canvas.height * 0.42,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let start: number | null = null;
    const currentGen = gameGenRef.current;

    function step(timestamp: number) {
      if (currentGen !== gameGenRef.current) {
        if (canvas) canvas.style.display = 'none';
        return; // Aborted by reset/unmount
      }

      if (!start) start = timestamp;
      const progress = timestamp - start;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.vrot;
        p.opacity = Math.max(0, 1 - progress / 2600);

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.opacity;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      });

      if (progress < 2600) {
        confettiAnimRef.current = requestAnimationFrame(step);
      } else {
        canvas!.style.display = 'none';
        confettiAnimRef.current = null;
      }
    }

    confettiAnimRef.current = requestAnimationFrame(step);
  };

  // --- Authentic Thick Calligraphic SVG Brush Stroke Win Line Calculation ---
  const drawBrushWinLine = (combo: [number, number, number], winner: 'X' | 'O') => {
    if (!boardRef.current) return;
    const cells = boardRef.current.querySelectorAll('.playz-cell');
    if (!cells[combo[0]] || !cells[combo[2]]) return;

    const rectBoard = boardRef.current.getBoundingClientRect();
    const startCell = cells[combo[0]].getBoundingClientRect();
    const endCell = cells[combo[2]].getBoundingClientRect();

    const bw = Math.round(rectBoard.width) || 210;
    const bh = Math.round(rectBoard.height) || 210;
    setBoardDims({ w: bw, h: bh });

    const x1 = (startCell.left + startCell.width / 2) - rectBoard.left;
    const y1 = (startCell.top + startCell.height / 2) - rectBoard.top;
    const x2 = (endCell.left + endCell.width / 2) - rectBoard.left;
    const y2 = (endCell.top + endCell.height / 2) - rectBoard.top;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // Extend line 16px past outer cell centers for an authentic full swipe
    const ext = 16;
    const sx = x1 - nx * ext;
    const sy = y1 - ny * ext;
    const ex = x2 + nx * ext;
    const ey = y2 + ny * ext;

    // Slight calligraphic bow / arc
    const cx = (sx + ex) / 2 + (-ny) * 4;
    const cy = (sy + ey) / 2 + (nx) * 4;
    const lineLen = Math.hypot(ex - sx, ey - sy) * 1.25;

    setBrushD(`M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    setBrushColor(winner === 'X' ? '#D05300' : '#00C853');
    setBrushLength(lineLen);
    setShowBrush(true);
    setBrushDrawn(false);

    brushFrameRef.current = requestAnimationFrame(() => {
      brushFrameRef.current = requestAnimationFrame(() => {
        setBrushDrawn(true);
      });
    });
  };

  // State-driven CPU turn scheduling with generation token safety (Audit 24)
  const scheduleCpuTurn = (currentB: PlayzCell[], currentGen: number) => {
    setIsCpuThinking(true);
    setStatusText('CPU Thinking...');

    cpuTimerRef.current = setTimeout(() => {
      cpuTimerRef.current = null;
      // Stale callback guard: verify generation token matches active game
      if (currentGen !== gameGenRef.current) return;

      const move = computeCpuMove(currentB, mode, 'O');
      if (move === -1 || currentB[move] !== null) {
        setIsCpuThinking(false);
        return;
      }

      const nextBoard = [...currentB];
      nextBoard[move] = 'O';
      setBoard(nextBoard);
      setIsCpuThinking(false);
      if (!isPreview) uwidgetsAudio.playTileClick(true);

      const winResult = checkWinner(nextBoard);
      if (winResult) {
        handleRoundEnd('O', winResult, nextBoard, currentGen);
        return;
      }

      if (isBoardFull(nextBoard)) {
        handleRoundEnd('Draw', null, nextBoard, currentGen);
        return;
      }

      setCurrentPlayer('X');
      setStatusText('Your Turn (X)');
    }, 340);
  };

  // Handle end of round and evaluate series progress (Audit 25)
  const handleRoundEnd = (
    outcome: 'X' | 'O' | 'Draw',
    winResult: WinResult | null,
    _finalBoard: PlayzCell[],
    currentGen: number
  ) => {
    setGameActive(false);

    let nextScoreX = scoreX;
    let nextScoreO = scoreO;
    let nextDraws = draws;

    if (outcome === 'X') {
      nextScoreX++;
      setScoreX(nextScoreX);
      setStatusText('🎉 Player X Wins Round!');
      setSubmessage(`Round ${currentRound} goes to Player X!`);
      if (winResult) drawBrushWinLine(winResult.combo, 'X');
    } else if (outcome === 'O') {
      nextScoreO++;
      setScoreO(nextScoreO);
      setStatusText(mode === '2P' ? '🎉 Player O Wins Round!' : '🤖 Opponent O Wins Round!');
      setSubmessage(`Round ${currentRound} goes to Opponent O!`);
      if (winResult) drawBrushWinLine(winResult.combo, 'O');
    } else {
      nextDraws++;
      setDraws(nextDraws);
      setStatusText('Round Draw! 🤝');
      setSubmessage('No points awarded for this round.');
    }

    // Evaluate series status against pure 5-round series rules
    const seriesEval = evaluateSeriesProgress(nextScoreX, nextScoreO, nextDraws, currentRound);

    if (seriesEval.isSeriesOver) {
      setIsSeriesOver(true);
      setRoundButtonLabel('Play Again');

      resultTimerRef.current = setTimeout(() => {
        resultTimerRef.current = null;
        if (currentGen !== gameGenRef.current) return;

        if (seriesEval.winner === 'X') {
          setStatusText('🏆 Player X Wins Series!');
          setSubmessage(`Match victory! Final Score: ${nextScoreX}–${nextScoreO} (${nextDraws} draw${nextDraws === 1 ? '' : 's'})`);
          triggerConfetti();
        } else if (seriesEval.winner === 'O') {
          setStatusText(mode === '2P' ? '🏆 Player O Wins Series!' : '🏆 Opponent O Wins Series!');
          setSubmessage(`Series victory: ${nextScoreO}–${nextScoreX} (${nextDraws} draw${nextDraws === 1 ? '' : 's'})`);
          triggerConfetti();
        } else {
          setStatusText('Match Series Tied! ⚖️');
          setSubmessage(`Even series: ${nextScoreX}–${nextScoreO} (${nextDraws} draw${nextDraws === 1 ? '' : 's'})`);
        }
      }, 420);
    } else {
      setRoundButtonLabel('Next Round →');
    }
  };

  // Human player cell click handler
  const handleCellClick = (index: number) => {
    if (!gameActive || isCpuThinking || board[index] !== null) return;
    if (mode !== '2P' && currentPlayer !== 'X') return;

    const nextBoard = [...board];
    nextBoard[index] = currentPlayer;
    setBoard(nextBoard);
    if (!isPreview) uwidgetsAudio.playTileClick(false);

    const winResult = checkWinner(nextBoard);
    if (winResult) {
      handleRoundEnd(currentPlayer, winResult, nextBoard, gameGenRef.current);
      return;
    }

    if (isBoardFull(nextBoard)) {
      handleRoundEnd('Draw', null, nextBoard, gameGenRef.current);
      return;
    }

    const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';
    setCurrentPlayer(nextPlayer);

    if (mode !== '2P' && nextPlayer === 'O') {
      scheduleCpuTurn(nextBoard, gameGenRef.current);
    } else {
      setStatusText(nextPlayer === 'X' ? 'Your Turn (X)' : "Player O's Turn");
    }
  };

  // Start new round with clean cancellation of prior state (Audits 24 & 25)
  const startNewRound = () => {
    if (isSeriesOver || currentRound >= maxRounds) {
      resetSeriesAll();
      return;
    }

    abortAllPendingAsync();
    const currentGen = gameGenRef.current;

    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);
    setBoard(Array(9).fill(null));
    setGameActive(true);
    setShowBrush(false);
    setBrushD('');
    setRoundButtonLabel('Next Round');
    setSubmessage('Make your move!');

    // Alternate starting player: odd rounds X starts, even rounds O starts
    const startingPlayer = nextRound % 2 !== 0 ? 'X' : 'O';
    setCurrentPlayer(startingPlayer);

    if (mode !== '2P' && startingPlayer === 'O') {
      scheduleCpuTurn(Array(9).fill(null), currentGen);
    } else {
      setStatusText(startingPlayer === 'X' ? 'Your Turn (X)' : "Player O's Turn");
    }
  };

  // Full reset of match series (Audit 24 & 25)
  const resetSeriesAll = () => {
    abortAllPendingAsync();
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setGameActive(true);
    setIsCpuThinking(false);
    setScoreX(0);
    setScoreO(0);
    setDraws(0);
    setCurrentRound(1);
    setIsSeriesOver(false);
    setShowBrush(false);
    setBrushD('');
    setRoundButtonLabel('Next Round');
    setStatusText('Your Turn (X)');
    setSubmessage('First to 3 wins or leader after 5 rounds!');
  };

  // Mode change cleanly resets series and cancels pending turns (Audit 24)
  const handleModeChange = (newMode: PlayzMode) => {
    abortAllPendingAsync();
    setMode(newMode);
    resetSeriesAll();
  };

  return (
    <div className="uwidget-shell" id="playz-widget-root">
      <canvas
        ref={canvasRef}
        id="confetti-canvas"
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999, display: 'none' }}
      />

      <WidgetChrome title="Playz" tag="Best of 5 Series" widgetId="playz" isPreview={isPreview} />

      {/* Surface 1: Scoreboard */}
      <section className="uwidget-card-top" style={{ padding: '8px 12px', minHeight: 'auto' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="card-title" style={{ fontSize: '13px' }}>Playz Match</h2>
            <p className="card-subtitle" style={{ fontSize: '11px' }}>5-Round Series · First to 3 or most wins!</p>
          </div>
          {/* Official Design System Segmented Control */}
          <div className="playz-mode-segmented">
            {(['Easy', 'Hard', '2P'] as PlayzMode[]).map(m => (
              <button
                key={m}
                type="button"
                className={`playz-mode-pill ${mode === m ? 'active' : ''}`}
                onClick={() => handleModeChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 5-Round Skewed Momentum Strip */}
        <div className="skew-strip">
          {Array.from({ length: totalBars }).map((_, i) => (
            <div
              key={i}
              className={`skew-bar ${i < filledBars ? 'active-orange' : ''}`}
            />
          ))}
        </div>

        {/* Score Boxes */}
        <div className="playz-score-grid">
          <div className={`playz-score-box ${currentPlayer === 'X' && gameActive ? 'active-turn-x' : ''}`}>
            <div>
              <div className="text-xs" style={{ color: '#797979' }}>PLAYER X</div>
              <div className="text-xs font-semibold" style={{ color: '#D05300' }}>You</div>
            </div>
            <span className="text-2xl font-bold tabular-nums">{scoreX}</span>
          </div>
          <div className={`playz-score-box ${currentPlayer === 'O' && gameActive ? 'active-turn-o' : ''}`}>
            <div>
              <div className="text-xs" style={{ color: '#797979' }}>OPPONENT O</div>
              <div className="text-xs font-semibold" style={{ color: '#00C853' }}>{mode === '2P' ? 'Player 2' : `CPU (${mode})`}</div>
            </div>
            <span className="text-2xl font-bold tabular-nums">{scoreO}</span>
          </div>
        </div>
      </section>

      {/* Surface 2: Arena */}
      <section className="uwidget-card-bottom">
        <div className="flex items-center justify-between w-full mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span className="text-xs font-semibold text-white">{statusText}</span>
          <span className="text-xs tabular-nums" style={{ color: '#797979', whiteSpace: 'nowrap', marginLeft: '8px' }}>
            Round {currentRound} of {maxRounds}{draws > 0 ? ` · ${draws} draw${draws === 1 ? '' : 's'}` : ''}
          </span>
        </div>

        {/* 3x3 Board with Authentic Thick Calligraphic SVG Brush Stroke Overlay */}
        <div className="playz-board-wrap" ref={boardRef}>
          {showBrush && (
            <svg
              className="brush-win-svg"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, display: 'block' }}
              viewBox={`0 0 ${boardDims.w} ${boardDims.h}`}
            >
              <defs>
                <filter id="brush-filter-playz" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.035 0.07" numOctaves="4" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="6.5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <path
                className="brush-win-line"
                d={brushD}
                stroke={brushColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#brush-filter-playz)"
                style={{
                  strokeDasharray: brushLength,
                  strokeDashoffset: brushDrawn ? 0 : brushLength,
                  transition: 'stroke-dashoffset 420ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </svg>
          )}

          {board.map((cell, idx) => (
            <button
              key={idx}
              type="button"
              className={`playz-cell ${cell ? `occupied mark-${cell.toLowerCase()}` : ''}`}
              onClick={() => handleCellClick(idx)}
              aria-label={`Cell ${idx + 1}: ${cell || 'Empty'}`}
              disabled={!gameActive || isCpuThinking || cell !== null}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className="text-xs font-medium text-center mb-3" style={{ color: '#00C853' }}>
          {submessage}
        </div>

        <div className="w-full h-[1px] mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

        {/* Controls */}
        <div className="controls-row">
          <button type="button" className="white-pill-btn" onClick={startNewRound}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>{roundButtonLabel}</span>
          </button>
          <button type="button" className="circle-icon-btn" onClick={triggerConfetti} title="Confetti celebration pop">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button type="button" className="circle-icon-btn" onClick={resetSeriesAll} title="Reset 5-Round Series">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
};
