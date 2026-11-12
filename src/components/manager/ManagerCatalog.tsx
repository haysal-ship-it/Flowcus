import React, { useState } from 'react';
import { WidgetMeta } from '../../types';
import { WIDGETS_CATALOG } from '../../utils/widgetsCatalog';

interface ManagerCatalogProps {
  onInspectWidget: (widget: WidgetMeta) => void;
  openStates: Record<string, boolean>;
  onToggleDesktop: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export const ManagerCatalog: React.FC<ManagerCatalogProps> = ({
  onInspectWidget,
  openStates,
  onToggleDesktop,
  favorites,
  onToggleFavorite,
}) => {
  const [filter, setFilter] = useState<string>('All');

  const categories = ['All', 'Productivity', 'Games', 'Utility'];

  const filtered = filter === 'All'
    ? WIDGETS_CATALOG
    : WIDGETS_CATALOG.filter(w => w.category === filter);

  return (
    <div className="manager-catalog-view">
      <div className="catalog-header">
        <div>
          <h1 className="catalog-title">Widget Catalog</h1>
          <p className="catalog-subtitle">Explore, test in preview, and pin standalone widgets to your desktop.</p>
        </div>

        <div className="catalog-filter-tabs" role="tablist" aria-label="Widget category filter">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={filter === cat}
              className={`filter-tab-btn ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-grid">
        {filtered.map(widget => {
          const isOpen = Boolean(openStates[widget.id]);
          const isFav = favorites.includes(widget.id);

          return (
            <div
              key={widget.id}
              className="catalog-card"
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
              <div className="catalog-card-top">
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

                <button
                  type="button"
                  className={`bento-fav-btn ${isFav ? 'favorited' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(widget.id);
                  }}
                  onKeyDown={e => e.stopPropagation()}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={isFav ? `Remove ${widget.name} from favorites` : `Add ${widget.name} to favorites`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={isFav ? '#FF4081' : 'none'} stroke={isFav ? '#FF4081' : 'currentColor'} strokeWidth="2" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              <div className="catalog-card-content">
                <h3 className="catalog-widget-name">{widget.name}</h3>
                <p className="catalog-widget-tagline">{widget.tagline}</p>
                <div className="catalog-meta-row">
                  <span>{widget.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{widget.defaultWidth}×{widget.defaultHeight}px</span>
                </div>
              </div>

              <div
                className="catalog-card-footer"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="bento-details-btn"
                  onClick={() => onInspectWidget(widget)}
                  aria-label={`Inspect ${widget.name} details`}
                >
                  Inspect
                </button>
                <button
                  type="button"
                  className={`bento-pin-btn ${isOpen ? 'btn-active-pinned' : ''}`}
                  onClick={() => onToggleDesktop(widget.id)}
                  aria-label={isOpen ? `Close ${widget.name} from desktop` : `Pin ${widget.name} to desktop`}
                >
                  {isOpen ? 'Pinned' : 'Pin to Desktop'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
