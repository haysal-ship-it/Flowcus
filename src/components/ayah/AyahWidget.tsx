import React, { useState } from 'react';
import { WidgetChrome } from '../common/WidgetChrome';
import quranData from '../../data/quran.json';

export interface AyahItem {
  id: string;
  surahName: string;
  surahNumber: number;
  ayahRange: string;
  classification: string;
  arabic: string;
  translation: string;
  theme: string;
  reflection: string;
}

export interface AyahWidgetProps {
  isPreview?: boolean;
}

export const AyahWidget: React.FC<AyahWidgetProps> = ({ isPreview = false }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [savedFavorites, setSavedFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('uwidgets_ayah_favs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [copied, setCopied] = useState<boolean>(false);

  const activeAyah: AyahItem = quranData[currentIndex % quranData.length] || quranData[0];
  const isFavorite = savedFavorites.includes(activeAyah.id);

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % quranData.length);
    setCopied(false);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + quranData.length) % quranData.length);
    setCopied(false);
  };

  const handleToggleFavorite = () => {
    if (isPreview) return;
    const next = isFavorite
      ? savedFavorites.filter(id => id !== activeAyah.id)
      : [...savedFavorites, activeAyah.id];
    setSavedFavorites(next);
    try {
      localStorage.setItem('uwidgets_ayah_favs', JSON.stringify(next));
    } catch {}
  };

  const handleCopy = async () => {
    const textToCopy = `${activeAyah.arabic}\n\n"${activeAyah.translation}"\n\n— ${activeAyah.surahName} (${activeAyah.surahNumber}:${activeAyah.ayahRange})`;
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

  return (
    <div className="uwidget-shell" id="ayah-widget-root">
      <WidgetChrome title="Ayah" tag="Daily Quran" widgetId="ayah" isPreview={isPreview} />

      {/* Surface 1: Surah Metadata */}
      <section className="uwidget-card-top" style={{ padding: '8px 12px', minHeight: 'auto', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '13px', margin: 0 }}>{activeAyah.surahName}</h2>
            <p className="card-subtitle" style={{ fontSize: '11px', margin: 0, color: '#00C853' }}>
              Chapter {activeAyah.surahNumber} · Verse {activeAyah.ayahRange}
            </p>
          </div>
          <span
            style={{
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '9999px',
              padding: '2px 8px',
              color: '#CBD5E1',
            }}
          >
            {activeAyah.classification}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#797979', paddingTop: '2px' }}>
          <span>Theme: <strong style={{ color: '#E2E8F0', fontWeight: 500 }}>{activeAyah.theme}</strong></span>
          <span style={{ color: '#00C853', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#00C853', display: 'inline-block' }}></span>
            Verse {(currentIndex % quranData.length) + 1} of {quranData.length}
          </span>
        </div>
      </section>

      {/* Surface 2: Scripture & Translation */}
      <section className="uwidget-card-bottom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
        {/* Arabic Calligraphy Block */}
        <div
          style={{
            textAlign: 'center',
            padding: '12px 6px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            direction: 'rtl',
          }}
        >
          <p
            style={{
              fontFamily: '"Amiri", "Traditional Arabic", "Scheherazade New", serif',
              fontSize: '19px',
              lineHeight: 1.9,
              color: '#FEF3C7',
              margin: 0,
              userSelect: 'text',
              letterSpacing: '0.01em',
            }}
          >
            {activeAyah.arabic}
          </p>
        </div>

        {/* Translation Block */}
        <div style={{ padding: '10px 4px 6px 4px' }}>
          <span
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
              color: '#797979',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            English Translation
          </span>
          <p
            style={{
              fontSize: '12px',
              lineHeight: 1.55,
              color: '#F1F5F9',
              margin: 0,
              fontStyle: 'normal',
            }}
          >
            “{activeAyah.translation}”
          </p>
        </div>

        {/* Reflection Badge */}
        <div
          style={{
            backgroundColor: '#111113',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '6px 8px',
            fontSize: '11px',
            color: '#8A8A8A',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          <span style={{ color: '#00C853', fontSize: '12px', flexShrink: 0 }}>✦</span>
          <span style={{ lineHeight: 1.4 }}>{activeAyah.reflection}</span>
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
              title="Copy verse to clipboard"
              aria-label="Copy verse to clipboard"
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
              title={isFavorite ? 'Remove bookmark' : 'Bookmark this verse'}
              aria-label={isFavorite ? 'Remove bookmark' : 'Bookmark this verse'}
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
              title="Previous verse"
              aria-label="Previous verse"
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
              title="Next verse"
              aria-label="Next verse"
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
