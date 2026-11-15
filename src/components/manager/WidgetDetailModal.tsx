import React, { useEffect, useRef } from 'react';
import { WidgetMeta } from '../../types';
import { FlowcusWidget } from '../FlowcusWidget';
import { PlayzWidget } from '../playz/PlayzWidget';
import { StickkWidget } from '../stickk/StickkWidget';
import { BlockzWidget } from '../blockz/BlockzWidget';
import { QuotzWidget } from '../quotz/QuotzWidget';
import { AyahWidget } from '../ayah/AyahWidget';
import { StatzWidget } from '../statz/StatzWidget';
import { RowzWidget } from '../rowz/RowzWidget';

interface WidgetDetailModalProps {
  widget: WidgetMeta | null;
  isOpen: boolean;
  isDesktopOpen: boolean;
  isPinned: boolean;
  onClose: () => void;
  onToggleDesktop: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export const WidgetDetailModal: React.FC<WidgetDetailModalProps> = ({
  widget,
  isOpen,
  isDesktopOpen,
  isPinned,
  onClose,
  onToggleDesktop,
  onTogglePin,
}) => {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus management: save trigger on open, focus initial element, restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        if (closeButtonRef.current) {
          closeButtonRef.current.focus();
        } else if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [isOpen]);

  // Clean up focus restoration on unmount
  useEffect(() => {
    return () => {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  // Keyboard navigation: Escape to close and Tab focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector))
          .filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !widget) return null;

  return (
    <div className="manager-modal-backdrop" onClick={onClose}>
      <div
        className="manager-detail-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-widget-title"
        aria-describedby="modal-widget-desc"
        tabIndex={-1}
        ref={modalRef}
      >
        {/* Fixed Modal Top Header (Matching Screenshot 2 - Does NOT scroll) */}
        <div className="modal-top-header">
          <div className="modal-header-left">
            <span
              className="modal-category-chip"
              style={{
                backgroundColor: `${widget.badgeColor}22`,
                color: widget.badgeColor,
                borderColor: `${widget.badgeColor}44`,
              }}
            >
              {widget.category}
            </span>
            <div>
              <h2 id="modal-widget-title" className="modal-header-title">{widget.name}</h2>
              <p className="modal-header-sub">{widget.tagline}</p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-icon"
            onClick={onClose}
            aria-label="Close widget detail modal"
            title="Close"
            ref={closeButtonRef}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Columns Body */}
        <div className="modal-columns-body">
          {/* Left Column: Live Scaled Widget Sandbox Preview */}
          <div className="modal-sandbox-col">
            <span className="sandbox-badge">Interactive Miniature</span>
            <div className="modal-preview-viewport">
              <div className="modal-preview-scale-wrapper">
                {widget.id === 'flowcus' && <FlowcusWidget isPreview={true} />}
                {widget.id === 'playz' && <PlayzWidget isPreview={true} />}
                {widget.id === 'stickk' && <StickkWidget isPreview={true} />}
                {widget.id === 'blockz' && <BlockzWidget isPreview={true} />}
                {widget.id === 'quotz' && <QuotzWidget isPreview={true} />}
                {widget.id === 'ayah' && <AyahWidget isPreview={true} />}
                {widget.id === 'statz' && <StatzWidget isPreview={true} />}
                {widget.id === 'rowz' && <RowzWidget isPreview={true} />}
              </div>
            </div>
          </div>

          {/* Right Column: Internal Scroll Area + Fixed Action Footer (Screenshot 2 Alignment) */}
          <div className="modal-details-col">
            {/* Scrollable Body (Only this area scrolls, with subtle 3.5px inset scrollbar) */}
            <div className="modal-info-scroll-body">
              <div>
                <h4 className="features-heading">Overview</h4>
                <p id="modal-widget-desc" className="modal-widget-description">
                  {widget.description}
                </p>
              </div>

              {/* Specifications Box */}
              <div className="modal-specs-box">
                <div className="spec-item">
                  <span className="spec-label">Default Dimensions</span>
                  <span className="spec-value">{widget.defaultWidth} × {widget.defaultHeight} px</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Position Memory</span>
                  <span className="spec-value">Remembers Desktop (X, Y)</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Window Style</span>
                  <span className="spec-value">Frameless &amp; Translucent</span>
                </div>
              </div>

              {/* Key Features List */}
              <div className="modal-features-list">
                <h4 className="features-heading">Key Features &amp; Tactile Design</h4>
                <ul>
                  {widget.features.map((feat, i) => (
                    <li key={i}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* How to use */}
              <div>
                <h4 className="features-heading">How to use on Desktop</h4>
                <p className="modal-widget-description" style={{ fontSize: '12.5px', color: '#999' }}>
                  Click "Pin to Desktop" below to launch the widget on your Windows wallpaper. Drag it anywhere using the top bar. Use the Always on Top button to keep it pinned over other active applications.
                </p>
              </div>
            </div>

            {/* Fixed Bottom Action Bar (W08: Authentic Dimensions and Desktop State) */}
            <div className="modal-action-footer">
              <div className="footer-stats">
                <span>{widget.category} · {widget.defaultWidth}×{widget.defaultHeight}px</span>
                <span aria-hidden="true">·</span>
                <span style={{ color: isDesktopOpen ? '#00C853' : '#797979' }}>
                  <span aria-hidden="true">● </span>{isDesktopOpen ? 'Running on Desktop' : 'Ready to Pin'}
                </span>
              </div>

              <div className="footer-buttons">
                <button
                  type="button"
                  className={`secondary-icon-btn ${isPinned ? 'is-pinned-top' : ''}`}
                  onClick={() => onTogglePin(widget.id)}
                  title={isPinned ? 'Always on Top: ON' : 'Always on Top: OFF'}
                  aria-label="Toggle Always on Top"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={isPinned ? '#F18A42' : 'none'} stroke={isPinned ? '#F18A42' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="17" x2="12" y2="22" />
                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`pin-primary-btn ${isDesktopOpen ? 'btn-active-pinned' : ''}`}
                  onClick={() => onToggleDesktop(widget.id)}
                >
                  {isDesktopOpen ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Pinned · Click to Close</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                      </svg>
                      <span>Pin to Desktop</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
