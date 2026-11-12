import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StickkPage, StickkTheme, StickkFont, StickkStroke } from '../../types';
import { WidgetChrome } from '../common/WidgetChrome';
import {
  loadStickkPages,
  loadStickkTrash,
  loadStickkStateAsync,
  saveStickkStateAsync,
  exportStickkNotes,
  importStickkNotesFromJson,
  pruneExpiredTrash,
} from '../../utils/stickkStorage';
import { uwidgetsAudio } from '../../utils/uwidgetsAudio';
import { isReducedMotion } from '../../utils/reducedMotion';
import { getPreviewStickkPages } from '../../utils/previewFixtures';

export interface StickkWidgetProps {
  isPreview?: boolean;
  initialPages?: StickkPage[];
}

export const StickkWidget: React.FC<StickkWidgetProps> = ({
  isPreview = false,
  initialPages,
}) => {
  // Page list and Trash stack
  const [pages, setPages] = useState<StickkPage[]>(() => {
    if (isPreview) return initialPages || getPreviewStickkPages();
    return loadStickkPages();
  });
  const [trash, setTrash] = useState<StickkPage[]>(() => {
    if (isPreview) return [];
    return loadStickkTrash();
  });

  // Audit 19: Stable active page ID rather than volatile array index
  const [activePageId, setActivePageId] = useState<string>(() => {
    if (pages.length > 0) return pages[0].id;
    return 'page-default';
  });

  const [currentMode, setCurrentMode] = useState<'type' | 'draw' | 'eraser'>('type');
  const [currentInk, setCurrentInk] = useState<string>('#1C1917');
  const [fontSize, setFontSize] = useState<number>(20);
  const [isRuled, setIsRuled] = useState<boolean>(true);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animClass, setAnimClass] = useState<string>('');

  // Audit 22: Save state indicator & recovery
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Audit 23: Undo stack & toast for deleted note recovery
  const [lastDeletedPage, setLastDeletedPage] = useState<StickkPage | null>(null);
  const [showUndoToast, setShowUndoToast] = useState<boolean>(false);
  const undoToastTimerRef = useRef<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit 20: Pointer capture and stroke state
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StickkStroke | null>(null);

  // Audit 21: Monotonic token to discard stale async image loads when switching notes rapidly
  const renderTokenRef = useRef<number>(0);
  const saveTimeoutRef = useRef<any>(null);

  // Resolve current active page safely
  const activePageIndex = Math.max(0, pages.findIndex(p => p.id === activePageId));
  const activePage = pages[activePageIndex] || pages[0];
  const nextIdx = (activePageIndex + 1) % pages.length;
  const underPage = pages[nextIdx] || activePage;

  // Sync activePageId if pages array changes and current ID no longer exists
  useEffect(() => {
    if (pages.length > 0 && !pages.some(p => p.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  // Load authoritative pages from Electron IPC on mount
  useEffect(() => {
    if (isPreview) return;

    let mounted = true;
    loadStickkStateAsync().then(({ pages: loadedPages, trash: loadedTrash }) => {
      if (!mounted) return;
      if (loadedPages && loadedPages.length > 0) {
        setPages(loadedPages);
        setActivePageId(prev => loadedPages.some(p => p.id === prev) ? prev : loadedPages[0].id);
      }
      if (loadedTrash && loadedTrash.length > 0) {
        setTrash(loadedTrash);
      }
    });

    // Listen for cross-window stickk updates
    const api = window.electronAPI;
    if (api && api.onStickkPagesUpdate) {
      const unsub = api.onStickkPagesUpdate((data: any) => {
        if (!mounted || !data) return;
        if (Array.isArray(data.pages)) {
          setPages(data.pages);
          setActivePageId(prev => data.pages.some((p: StickkPage) => p.id === prev) ? prev : (data.pages[0]?.id || prev));
        }
        if (Array.isArray(data.trash)) {
          setTrash(data.trash);
        }
      });
      return () => {
        mounted = false;
        if (typeof unsub === 'function') unsub();
      };
    }

    return () => {
      mounted = false;
    };
  }, [isPreview]);

  // Debounced auto-save to Electron durable store & localStorage
  const triggerSave = useCallback((pagesToSave: StickkPage[], trashToSave: StickkPage[]) => {
    if (isPreview) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    setSaveError(null);

    saveTimeoutRef.current = setTimeout(async () => {
      const prunedTrash = pruneExpiredTrash(trashToSave);
      const res = await saveStickkStateAsync(pagesToSave, prunedTrash);
      if (res.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
        setSaveError(res.error || 'Failed to save notes');
      }
    }, 450);
  }, [isPreview]);

  useEffect(() => {
    if (isPreview) return;
    triggerSave(pages, trash);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [pages, trash, triggerSave, isPreview]);

  // Audit 21: Draw normalized vector strokes with DPI-aware devicePixelRatio
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // If page has vector strokes, render them cleanly at any size/DPR
    const strokes = activePage?.strokes;
    if (strokes && strokes.length > 0) {
      for (const stroke of strokes) {
        if (!stroke.points || stroke.points.length === 0) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = stroke.size || 18;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color || '#1C1917';
          ctx.lineWidth = stroke.size || 2.6;
        }

        ctx.beginPath();
        const firstPt = stroke.points[0];
        ctx.moveTo(firstPt.x * width, firstPt.y * height);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo(pt.x * width, pt.y * height);
        }
        ctx.stroke();
        ctx.restore();
      }
    } else if (activePage?.doodleDataUrl) {
      // Legacy raster fallback with monotonic render token guard (Audit 21)
      const token = ++renderTokenRef.current;
      const img = new Image();
      img.onload = () => {
        if (token !== renderTokenRef.current) return; // Stale async image load discarded
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
      };
      img.src = activePage.doodleDataUrl;
    }

    ctx.restore();
  }, [activePage?.id, activePage?.strokes, activePage?.doodleDataUrl]);

  // Re-draw when active note or parent size changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // ResizeObserver for DPI and window resize changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      redrawCanvas();
    });

    ro.observe(parent);
    return () => ro.disconnect();
  }, [redrawCanvas]);

  // Audit 20: Pointer events with setPointerCapture and normalized stroke points
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (currentMode === 'type') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}

    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newStroke: StickkStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool: currentMode === 'eraser' ? 'eraser' : 'draw',
      color: currentMode === 'eraser' ? '#000000' : currentInk,
      size: currentMode === 'eraser' ? 18 : 2.6,
      points: [{ x: normX, y: normY }],
    };
    currentStrokeRef.current = newStroke;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (newStroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = newStroke.size;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = newStroke.color;
        ctx.lineWidth = newStroke.size;
      }
      ctx.beginPath();
      ctx.moveTo(normX * rect.width, normY * rect.height);
      ctx.lineTo(normX * rect.width + 0.1, normY * rect.height + 0.1);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current || currentMode === 'type') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const stroke = currentStrokeRef.current;
    const lastPt = stroke.points[stroke.points.length - 1];
    stroke.points.push({ x: normX, y: normY });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = stroke.size;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
      }
      ctx.beginPath();
      ctx.moveTo(lastPt.x * rect.width, lastPt.y * rect.height);
      ctx.lineTo(normX * rect.width, normY * rect.height);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handleEndStroke = (pointerId: number, cancelled: boolean) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(pointerId)) {
      try {
        canvas.releasePointerCapture(pointerId);
      } catch {}
    }

    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (!cancelled && completedStroke && completedStroke.points.length > 0) {
      const rasterSnapshot = canvas?.toDataURL();
      setPages(prev => prev.map(p => {
        if (p.id !== activePageId) return p;
        const strokes = p.strokes || [];
        return {
          ...p,
          strokes: [...strokes, completedStroke],
          doodleDataUrl: rasterSnapshot || p.doodleDataUrl,
          updatedAt: new Date().toISOString(),
        };
      }));
    }
  };

  // --- Smooth 3D Page Navigation ---
  const goToPageById = (targetId: string) => {
    if (isAnimating || targetId === activePageId) return;
    const targetIdx = pages.findIndex(p => p.id === targetId);
    if (targetIdx === -1) return;

    if (isReducedMotion()) {
      if (!isPreview) uwidgetsAudio.playPageFlip();
      setActivePageId(targetId);
      return;
    }

    setIsAnimating(true);
    const forward = targetIdx > activePageIndex;
    const anim = forward ? 'anim-smooth-flip-next' : 'anim-smooth-flip-prev';
    setAnimClass(anim);
    if (!isPreview) uwidgetsAudio.playPageFlip();

    setTimeout(() => {
      setActivePageId(targetId);
    }, 360);

    setTimeout(() => {
      setAnimClass('');
      setIsAnimating(false);
    }, 730);
  };

  const handleFlipNext = () => {
    if (pages.length <= 1) return;
    const nextIndex = (activePageIndex + 1) % pages.length;
    goToPageById(pages[nextIndex].id);
  };

  // Audit 19: Immediately navigate to new note using stable page ID and focus input
  const handleAddNewPage = () => {
    const newId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPage: StickkPage = {
      id: newId,
      title: `Note ${pages.length + 1}`,
      theme: 'theme-orange',
      font: 'font-marker',
      text: '',
      strokes: [],
      updatedAt: new Date().toISOString(),
    };

    setPages(prev => [...prev, newPage]);
    setActivePageId(newId);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
  };

  // Audit 23: Soft-delete to trash with Undo toast and 30-day retention
  const handleTearPage = () => {
    if (isAnimating || !activePage) return;

    const pageToDelete: StickkPage = {
      ...activePage,
      deletedAt: new Date().toISOString(),
    };

    if (isReducedMotion()) {
      if (!isPreview) uwidgetsAudio.playPaperTear();
      setTrash(prev => [pageToDelete, ...prev.slice(0, 49)]);
      setLastDeletedPage(pageToDelete);
      setShowUndoToast(true);

      if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
      undoToastTimerRef.current = setTimeout(() => {
        setShowUndoToast(false);
        setLastDeletedPage(null);
      }, 5000);

      if (pages.length > 1) {
        setPages(prev => {
          const updated = prev.filter(p => p.id !== activePage.id);
          const nextIndex = activePageIndex >= updated.length ? updated.length - 1 : activePageIndex;
          setActivePageId(updated[nextIndex].id);
          return updated;
        });
      } else {
        const freshId = `page-${Date.now()}`;
        const freshPage: StickkPage = {
          id: freshId,
          title: 'Fresh Sticky Note',
          theme: 'theme-yellow',
          font: 'font-caveat',
          text: '',
          strokes: [],
          updatedAt: new Date().toISOString(),
        };
        setPages([freshPage]);
        setActivePageId(freshId);
      }
      return;
    }

    setIsAnimating(true);
    setAnimClass('anim-paper-tear');
    if (!isPreview) uwidgetsAudio.playPaperTear();

    setTimeout(() => {
      // Add to trash stack
      setTrash(prev => [pageToDelete, ...prev.slice(0, 49)]);
      setLastDeletedPage(pageToDelete);
      setShowUndoToast(true);

      if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
      undoToastTimerRef.current = setTimeout(() => {
        setShowUndoToast(false);
        setLastDeletedPage(null);
      }, 5000);

      if (pages.length > 1) {
        setPages(prev => {
          const updated = prev.filter(p => p.id !== activePage.id);
          const nextIndex = activePageIndex >= updated.length ? updated.length - 1 : activePageIndex;
          setActivePageId(updated[nextIndex].id);
          return updated;
        });
      } else {
        // Reset to fresh note if last page was torn
        const freshId = `page-${Date.now()}`;
        const freshPage: StickkPage = {
          id: freshId,
          title: 'Fresh Sticky Note',
          theme: 'theme-yellow',
          font: 'font-caveat',
          text: '',
          strokes: [],
          updatedAt: new Date().toISOString(),
        };
        setPages([freshPage]);
        setActivePageId(freshId);
      }

      setAnimClass('');
      setIsAnimating(false);
    }, 580);
  };

  // Recover deleted note from trash via Undo
  const handleUndo = useCallback(() => {
    if (!lastDeletedPage) return;
    const restored: StickkPage = {
      ...lastDeletedPage,
      deletedAt: undefined,
    };

    setPages(prev => [restored, ...prev]);
    setTrash(prev => prev.filter(p => p.id !== lastDeletedPage.id));
    setActivePageId(restored.id);
    setShowUndoToast(false);
    setLastDeletedPage(null);
    if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
  }, [lastDeletedPage]);

  // Keyboard shortcut: Ctrl+Z to undo deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (showUndoToast && lastDeletedPage) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUndoToast, lastDeletedPage, handleUndo]);

  const handleTitleChange = (val: string) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, title: val, updatedAt: new Date().toISOString() } : p));
  };

  const handleTextChange = (val: string) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, text: val, updatedAt: new Date().toISOString() } : p));
  };

  const handleSetFont = (font: StickkFont) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, font } : p));
  };

  const handleSetTheme = (theme: StickkTheme) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, theme } : p));
    if (theme === 'theme-dark' && currentInk === '#1C1917') {
      setCurrentInk('#FFFFFF');
    } else if (theme !== 'theme-dark' && currentInk === '#FFFFFF') {
      setCurrentInk('#1C1917');
    }
  };

  const handleClearNote = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, text: '', strokes: [], doodleDataUrl: undefined } : p));
  };

  // Audit 22: Export notes & drawings
  const handleExport = () => {
    exportStickkNotes(pages, trash);
  };

  // Audit 22: Import notes from JSON
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const result = importStickkNotesFromJson(content);
      if (result.success && result.pages) {
        // Merge with existing pages preserving non-colliding notes
        const existingIds = new Set(pages.map(p => p.id));
        const mergedPages = [...pages];
        for (const imp of result.pages) {
          const idx = mergedPages.findIndex(p => p.id === imp.id);
          if (idx !== -1) {
            mergedPages[idx] = imp;
          } else {
            mergedPages.push(imp);
          }
        }
        setPages(mergedPages);
        if (result.trash && result.trash.length > 0) {
          setTrash(prev => [...result.trash!, ...prev]);
        }
        setActivePageId(result.pages[0].id);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        alert(result.error || 'Failed to import notes JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="uwidget-shell" id="stickk-widget-root">
      <WidgetChrome title="Stickk" tag="Sketchpad" widgetId="stickk" isPreview={isPreview} />

      {/* Surface 1: Navigation & Theme Selector (RC2 Deliberate 4-Row Compact Layout) */}
      <section className="uwidget-card-top" style={{ padding: '8px 12px', minHeight: 'auto' }}>
        {/* Row 1: Title and Status */}
        <div className="stickk-toolbar-row">
          <h2 className="card-title" style={{ fontSize: '13px', margin: 0 }}>Stickk Notes</h2>
          <span className="card-subtitle" style={{ fontSize: '11px', color: '#797979' }}>
            Page {activePageIndex + 1} of {pages.length} · {activePage?.font.replace('font-', '')}
          </span>
        </div>

        {/* Row 2: Page Navigation Capsule */}
        <div className="stickk-toolbar-row" style={{ paddingTop: '4px' }}>
          <div className="stickk-pages-capsule" style={{ width: 'auto', display: 'inline-flex' }}>
            <span className="stickk-page-label">Page:</span>
            {pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`stickk-page-pill ${p.id === activePageId ? 'active' : ''}`}
                onClick={() => goToPageById(p.id)}
                aria-label={`Go to page ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              className="stickk-page-add-btn"
              onClick={handleAddNewPage}
              title="Add blank page"
              aria-label="Add blank page"
            >
              +
            </button>
          </div>
        </div>

        {/* Row 3: Theme Swatches */}
        <div className="stickk-toolbar-row" style={{ paddingTop: '6px' }}>
          <div className="stickk-toolbar-group">
            <span className="text-xs" style={{ color: '#797979', fontSize: '11px' }}>Theme:</span>
            <div className="stickk-toolbar-group" role="radiogroup" aria-label="Note theme">
              {(['theme-yellow', 'theme-orange', 'theme-mint', 'theme-lavender', 'theme-dark'] as StickkTheme[]).map(th => {
                const bg = th === 'theme-yellow' ? '#FEF08A' : th === 'theme-orange' ? '#FED7AA' : th === 'theme-mint' ? '#A7F3D0' : th === 'theme-lavender' ? '#E9D5FF' : '#1F2023';
                const isSelected = activePage?.theme === th;
                return (
                  <button
                    key={th}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`theme-swatch-circle ${isSelected ? 'active' : ''}`}
                    style={{
                      background: bg,
                      width: '16px',
                      height: '16px',
                      minWidth: '16px',
                      minHeight: '16px',
                      flexShrink: 0,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #FFFFFF' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: isSelected ? '0 0 0 1px #000000, 0 0 6px rgba(255,255,255,0.4)' : 'none',
                    }}
                    onClick={() => handleSetTheme(th)}
                    aria-label={`Theme ${th.replace('theme-', '')}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 4: Data Actions & Save Feedback */}
        <div className="stickk-toolbar-row" style={{ paddingTop: '6px' }}>
          <div className="stickk-toolbar-group">
            {saveStatus === 'saving' && (
              <span className="stickk-save-indicator saving" title="Saving notes...">
                <span className="stickk-save-dot" />
                <span>Saving</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="stickk-save-indicator saved" title="All notes saved">
                <span className="stickk-save-dot" />
                <span>Saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                type="button"
                className="stickk-save-indicator error"
                onClick={() => triggerSave(pages, trash)}
                title={`Save failed: ${saveError || 'Retry'}`}
              >
                <span>⚠ Retry</span>
              </button>
            )}
            {saveStatus === 'idle' && (
              <span style={{ fontSize: '10px', color: '#666666' }}>Auto-save active</span>
            )}
          </div>

          <div className="stickk-toolbar-group">
            <button
              type="button"
              className="stickk-mini-btn"
              onClick={handleExport}
              title="Export all notes to JSON"
              aria-label="Export notes"
            >
              Export
            </button>
            <button
              type="button"
              className="stickk-mini-btn"
              onClick={handleImportClick}
              title="Import notes from JSON"
              aria-label="Import notes"
            >
              Import
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          style={{ display: 'none' }}
        />
      </section>

      {/* Surface 2: 3D Animated Sticky Note Pad */}
      <section className="uwidget-card-bottom">
        <div className="sketchpad-perspective-viewport">
          {/* Underneath Page (revealed as top flap turns) */}
          <div className={`under-page ${underPage.theme}`}>
            <div className="sticky-top-strip">
              <span className="font-semibold text-xs opacity-60">{underPage.title}</span>
            </div>
            <div className="sketchpad-content-box paper-ruled p-4">
              <span className={`text-lg opacity-40 ${underPage.font}`}>
                {underPage.text.slice(0, 45) || 'Blank page waiting...'}
              </span>
            </div>
          </div>

          {/* Active Front Page with 3D animation */}
          <div id="sticky-note-object" className={`sticky-note-pad ${activePage?.theme || 'theme-yellow'} ${animClass}`}>
            <div className="flap-shadow-overlay" style={{ opacity: isAnimating ? 0.7 : 0 }} />

            <div className="sticky-top-strip">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-black/25" />
                <input
                  type="text"
                  value={activePage?.title || ''}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="bg-transparent font-semibold text-xs border-none outline-none w-44 truncate placeholder-black/40"
                  style={{ background: 'transparent', border: 'none', outline: 'none' }}
                  placeholder="Sticky note title"
                />
              </div>
              <span className="text-[11px] opacity-60">Page {activePageIndex + 1}</span>
            </div>

            <div className={`sketchpad-content-box ${isRuled ? 'paper-ruled' : ''}`} id="paper-surface">
              <textarea
                ref={textareaRef}
                id="typed-textarea"
                value={activePage?.text || ''}
                onChange={e => handleTextChange(e.target.value)}
                className={activePage?.font || 'font-caveat'}
                style={{
                  fontSize: `${fontSize}px`,
                  color: currentInk,
                  pointerEvents: currentMode === 'type' ? 'auto' : 'none',
                  scrollbarWidth: 'none',
                  overflow: 'hidden',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                }}
                placeholder="Start typing your thoughts in a funky font..."
              />
              <canvas
                ref={canvasRef}
                id="drawing-canvas"
                style={{
                  pointerEvents: currentMode === 'type' ? 'none' : 'auto',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => handleEndStroke(e.pointerId, false)}
                onPointerCancel={(e) => handleEndStroke(e.pointerId, true)}
                onLostPointerCapture={(e) => handleEndStroke(e.pointerId, false)}
              />
            </div>

            {/* 5 Funky Fonts Subbar */}
            <div className="font-selector-bar">
              <span className="text-[11px] opacity-70 font-medium shrink-0">Font:</span>
              <div className="flex items-center gap-1 shrink-0">
                {(['font-caveat', 'font-comic', 'font-gloria', 'font-pacifico', 'font-marker'] as StickkFont[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`font-chip ${f} ${activePage?.font === f ? 'active' : ''}`}
                    onClick={() => handleSetFont(f)}
                  >
                    {f.replace('font-', '')}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button type="button" className="font-chip" onClick={() => setFontSize(s => Math.max(14, s - 2))}>A-</button>
                <button type="button" className="font-chip" onClick={() => setFontSize(s => Math.min(32, s + 2))}>A+</button>
              </div>
            </div>

            {/* In-Note Toolstrip */}
            <div className="sketch-tools-bar">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={`tool-btn ${currentMode === 'type' ? 'active' : ''}`}
                  onClick={() => setCurrentMode('type')}
                >
                  <span>⌨️ Type</span>
                </button>
                <button
                  type="button"
                  className={`tool-btn ${currentMode === 'draw' ? 'active' : ''}`}
                  onClick={() => setCurrentMode('draw')}
                >
                  <span>✏️ Draw</span>
                </button>
                <button
                  type="button"
                  className={`tool-btn ${currentMode === 'eraser' ? 'active' : ''}`}
                  onClick={() => setCurrentMode('eraser')}
                >
                  <span>🧹 Eraser</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {['#1C1917', '#D05300', '#2563EB', '#059669'].map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`ink-swatch ${currentInk === c ? 'active-ink' : ''}`}
                    style={{ background: c }}
                    onClick={() => setCurrentInk(c)}
                    aria-label={`Ink color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audit 23: Floating Undo Toast */}
        {showUndoToast && lastDeletedPage && (
          <div className="stickk-undo-toast" role="status" aria-live="polite">
            <span>Note deleted</span>
            <button type="button" className="stickk-undo-btn" onClick={handleUndo}>
              Undo
            </button>
          </div>
        )}

        {/* Tightly Positioned Bottom Action Buttons (docked, flex-shrink: 0, guaranteed visible) */}
        <div className="controls-row">
          <button type="button" className="white-pill-btn" onClick={handleFlipNext} aria-label="Flip to next note page">
            <span>Flip Next Page →</span>
          </button>
          <button
            type="button"
            className="circle-icon-btn tear-btn"
            onClick={handleTearPage}
            title="Tear / Rip Off this page!"
            aria-label="Tear and discard page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          <button
            type="button"
            className="circle-icon-btn"
            onClick={() => setIsRuled(r => !r)}
            title="Toggle Ruled Lines / Blank Paper"
            aria-label="Toggle ruled lines"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            className="circle-icon-btn"
            onClick={handleClearNote}
            title="Clear text & doodles on this page"
            aria-label="Clear note"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
};
