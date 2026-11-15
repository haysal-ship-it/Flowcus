import React, { useState, useEffect } from 'react';
import { WidgetChrome } from '../common/WidgetChrome';
import quotesData from '../../data/quotes.json';

export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  source: string;
  topic: string;
}

export interface QuotzWidgetProps {
  isPreview?: boolean;
}

export const QuotzWidget: React.FC<QuotzWidgetProps> = ({ isPreview = false }) => {
  const [topic, setTopic] = useState<string>('All');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [savedFavorites, setSavedFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('uwidgets_quotz_favs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [copied, setCopied] = useState<boolean>(false);

  const topics = ['All', 'Focus', 'Philosophy', 'Resilience', 'Calm'];

  const filteredQuotes: QuoteItem[] = topic === 'All'
    ? quotesData
    : quotesData.filter(q => q.topic.toLowerCase() === topic.toLowerCase());

  const activeQuote: QuoteItem = filteredQuotes[currentIndex % filteredQuotes.length] || quotesData[0];
  const isFavorite = savedFavorites.includes(activeQuote.id);

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % filteredQuotes.length);
    setCopied(false);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + filteredQuotes.length) % filteredQuotes.length);
    setCopied(false);
  };

  const handleToggleFavorite = () => {
    if (isPreview) return;
    const next = isFavorite
      ? savedFavorites.filter(id => id !== activeQuote.id)
      : [...savedFavorites, activeQuote.id];
    setSavedFavorites(next);
    try {
      localStorage.setItem('uwidgets_quotz_favs', JSON.stringify(next));
    } catch {}
  };

  const handleCopy = async () => {
    const textToCopy = `“${activeQuote.text}” — ${activeQuote.author} (${activeQuote.source})`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset index when topic filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setCopied(false);
  }, [topic]);

  const todayStr = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="uwidget-shell" id="quotz-widget-root">
      <WidgetChrome title="Quotz" tag="Daily Wisdom" widgetId="quotz" isPreview={isPreview} />

      {/* Surface 1: Discovery & Filter */}
      <section className="uwidget-card-top" style={{ padding: '8px 12px', minHeight: 'auto', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '13px', margin: 0 }}>Daily Quotz</h2>
            <p className="card-subtitle" style={{ fontSize: '11px', margin: 0, color: '#797979' }}>Mindful words for focus & calm</p>
          </div>
          <span style={{ fontSize: '11px', color: '#797979', fontFamily: 'monospace' }}>
            {todayStr}
          </span>
        </div>

        {/* Topic Pill Selector */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '2px 0', scrollbarWidth: 'none' }} role="tablist" aria-label="Quote categories">
          {topics.map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={topic === t}
              onClick={() => setTopic(t)}
              style={{
                fontSize: '11px',
                fontWeight: topic === t ? 600 : 400,
                color: topic === t ? '#FFFFFF' : '#8A8A8A',
                backgroundColor: topic === t ? '#D05300' : 'rgba(255, 255, 255, 0.05)',
                border: topic === t ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '9999px',
                padding: '3px 8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Surface 2: Typographic Quote Card */}
      <section className="uwidget-card-bottom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, position: 'relative' }}>
        {/* Large Decorative Watermark Quote Glyphs */}
        <span
          style={{
            position: 'absolute',
            top: '4px',
            right: '12px',
            fontSize: '52px',
            lineHeight: 1,
            fontFamily: 'serif',
            color: 'rgba(255, 255, 255, 0.04)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
          aria-hidden="true"
        >
          “
        </span>

        {/* Quote Content Block */}
        <div style={{ paddingTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                color: '#D05300',
              }}
            >
              Reflection · {activeQuote.topic}
            </span>
            <span style={{ fontSize: '11px', color: '#797979', fontFamily: 'monospace' }}>
              {(currentIndex % filteredQuotes.length) + 1} of {filteredQuotes.length}
            </span>
          </div>

          <p
            style={{
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: 1.6,
              color: '#F1F5F9',
              fontStyle: 'italic',
              margin: '0 0 12px 0',
              letterSpacing: '-0.01em',
            }}
          >
            “{activeQuote.text}”
          </p>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
              {activeQuote.author}
            </h3>
            <p style={{ fontSize: '11px', color: '#797979', margin: '2px 0 0 0' }}>
              {activeQuote.source}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: '8px',
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy quote to clipboard"
              aria-label="Copy quote to clipboard"
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#00C853' : '#8A8A8A',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
              }}
            >
              <span>{copied ? '✓' : '⎘'}</span>
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFavorite}
              title={isFavorite ? 'Remove bookmark' : 'Bookmark this quote'}
              aria-label={isFavorite ? 'Remove bookmark' : 'Bookmark this quote'}
              aria-pressed={isFavorite}
              style={{
                background: 'transparent',
                border: 'none',
                color: isFavorite ? '#F18A42' : '#5A5A5A',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ★
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handlePrev}
              title="Previous quote"
              aria-label="Previous quote"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Next quote"
              aria-label="Next quote"
              style={{
                height: '26px',
                borderRadius: '9999px',
                background: '#FFFFFF',
                border: 'none',
                color: '#000000',
                fontSize: '11px',
                fontWeight: 600,
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
