import React, { useState } from 'react';
import { WidgetMeta } from '../../types';
import { WIDGETS_CATALOG } from '../../utils/widgetsCatalog';

interface ManagerHomeProps {
  onInspectWidget: (widget: WidgetMeta) => void;
  openStates: Record<string, boolean>;
  pinnedStates: Record<string, boolean>;
  onToggleDesktop: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export const ManagerHome: React.FC<ManagerHomeProps> = ({
  onInspectWidget,
  openStates,
  pinnedStates,
  onToggleDesktop,
  favorites,
  onToggleFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Productivity', 'Games', 'Utility', 'Favorites'];

  const filteredWidgets = WIDGETS_CATALOG.filter(w => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Favorites') return favorites.includes(w.id);
    return w.category === selectedCategory;
  });

  return (
    <div className="manager-home-view">
      {/* Hero Banner with Warm Ambient Glow */}
      <section className="manager-hero-banner">
        <div className="hero-ambient-glow" />
        <div className="hero-content">
          <div className="hero-text-block">
            <span className="hero-pill-tag">Uwidgets Desktop 1.0</span>
            <h1 className="hero-title">Make Windows yours.</h1>
            <p className="hero-subtitle">
              Calm, tactile desktop widgets crafted for daily focus, quick notes, and mini-breaks. Pin anywhere on your desktop.
            </p>
          </div>

          <div className="hero-search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search widgets by name or feature..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search widgets"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Category Filter Chips */}
      <div className="manager-filter-bar">
        <div className="filter-chips-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="results-count-text">
          Showing {filteredWidgets.length} {filteredWidgets.length === 1 ? 'widget' : 'widgets'}
        </span>
      </div>

      {/* Bento Grid */}
      <div className="manager-bento-grid">
        {filteredWidgets.map(widget => {
          const isOpen = Boolean(openStates[widget.id]);
          const isPinned = Boolean(pinnedStates[widget.id]);
          const isFav = favorites.includes(widget.id);

          return (
            <div
              key={widget.id}
              className={`bento-card bento-${widget.id} ${isOpen ? 'is-running' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${widget.name}`}
              onClick={() => onInspectWidget(widget)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onInspectWidget(widget);
                }
              }}
            >
              {/* Card Header */}
              <div className="bento-card-header">
                <span
                  className="bento-badge"
                  style={{
                    backgroundColor: `${widget.badgeColor}22`,
                    color: widget.badgeColor,
                    borderColor: `${widget.badgeColor}44`,
                  }}
                >
                  {widget.category}
                </span>

                <div className="bento-header-actions" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`bento-fav-btn ${isFav ? 'favorited' : ''}`}
                    onClick={() => onToggleFavorite(widget.id)}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={isFav ? `Remove ${widget.name} from favorites` : `Add ${widget.name} to favorites`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={isFav ? '#FF4081' : 'none'} stroke={isFav ? '#FF4081' : 'currentColor'} strokeWidth="2" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>

                  <span className={`status-pill ${isOpen ? 'status-open' : 'status-ready'}`}>
                    {isOpen ? 'Pinned on Desktop' : 'Ready'}
                  </span>
                </div>
              </div>

              {/* Graphic Preview Area */}
              <div className="bento-graphic-area">
                {widget.id === 'flowcus' && (
                  <div className="bento-preview-flowcus">
                    <div className="mini-flip-unit">
                      <span>2</span><span>5</span>
                    </div>
                    <span className="mini-colon">:</span>
                    <div className="mini-flip-unit">
                      <span>0</span><span>0</span>
                    </div>
                  </div>
                )}

                {widget.id === 'playz' && (
                  <div className="bento-preview-playz">
                    <div className="mini-grid">
                      <span className="mark-x">✕</span>
                      <span className="mark-o">○</span>
                      <span className="mark-x">✕</span>
                    </div>
                    <div className="mini-brush-stroke" />
                  </div>
                )}

                {widget.id === 'stickk' && (
                  <div className="bento-preview-stickk">
                    <div className="mini-sticky-page">
                      <div className="mini-pin-head" />
                      <span className="mini-handwriting">Quick Ideas &amp; Sketches ✏️</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Meta Content */}
              <div className="bento-card-body">
                <div className="bento-title-row">
                  <h3 className="bento-card-title">{widget.name}</h3>
                  <span className="bento-card-rating" style={{ fontSize: '11px', color: '#999' }}>{widget.defaultWidth}×{widget.defaultHeight}px</span>
                </div>
                <p className="bento-card-tagline">{widget.tagline}</p>
              </div>

              {/* Card Footer CTAs */}
              <div
                className="bento-card-footer"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="bento-details-btn"
                  onClick={() => onInspectWidget(widget)}
                  aria-label={`Inspect ${widget.name} details`}
                >
                  View details
                </button>

                <button
                  type="button"
                  className={`bento-pin-btn ${isOpen ? 'btn-active-pinned' : ''}`}
                  onClick={() => onToggleDesktop(widget.id)}
                  aria-label={isOpen ? `Close ${widget.name} from desktop` : `Pin ${widget.name} to desktop`}
                >
                  {isOpen ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Pinned</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                      </svg>
                      <span>Pin to Desktop</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
