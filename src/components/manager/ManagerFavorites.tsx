import React from 'react';
import { WidgetMeta } from '../../types';
import { WIDGETS_CATALOG } from '../../utils/widgetsCatalog';

interface ManagerFavoritesProps {
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onInspectWidget: (widget: WidgetMeta) => void;
  openStates: Record<string, boolean>;
  onToggleDesktop: (id: string) => void;
}

export const ManagerFavorites: React.FC<ManagerFavoritesProps> = ({
  favorites,
  onToggleFavorite,
  onInspectWidget,
  openStates,
  onToggleDesktop,
}) => {
  const favoriteWidgets = WIDGETS_CATALOG.filter(w => favorites.includes(w.id));

  return (
    <div className="manager-favorites-view">
      <div className="catalog-header">
        <div>
          <h1 className="catalog-title">Favorite Widgets</h1>
          <p className="catalog-subtitle">Quick access to your starred widgets for fast desktop pinning.</p>
        </div>
      </div>

      {favoriteWidgets.length === 0 ? (
        <div className="favorites-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#797979" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <h3 className="empty-title">No favorites yet</h3>
          <p className="empty-desc">Click the heart icon on any widget in Home or Catalog to pin it here.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {favoriteWidgets.map(widget => {
            const isOpen = Boolean(openStates[widget.id]);

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
                    className="bento-fav-btn favorited"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(widget.id);
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    title="Remove from favorites"
                    aria-label={`Remove ${widget.name} from favorites`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#FF4081" stroke="#FF4081" strokeWidth="2" aria-hidden="true">
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
                    Details
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
      )}
    </div>
  );
};
