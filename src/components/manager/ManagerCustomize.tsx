import React, { useState, useEffect } from 'react';
import { uwidgetsAudio } from '../../utils/uwidgetsAudio';

export const ManagerCustomize: React.FC = () => {
  const [selectedAccent, setSelectedAccent] = useState<string>('#D05300');
  const [scale, setScale] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');

  const accents = [
    { name: 'Burnt Orange', color: '#D05300' },
    { name: 'Warm Amber', color: '#F18A42' },
    { name: 'Focus Emerald', color: '#00C853' },
    { name: 'Cyber Blue', color: '#38BDF8' },
    { name: 'Neon Violet', color: '#A855F7' },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then((res) => {
        if (res) {
          if (res.accentColor) {
            setSelectedAccent(res.accentColor);
            document.documentElement.style.setProperty('--color-accent', res.accentColor);
            document.documentElement.style.setProperty('--flowcus-accent', res.accentColor);
          }
          if (res.scaleFactor) {
            setScale(res.scaleFactor);
          }
        }
      }).catch(() => {});
    }
  }, []);

  const handleAccentChange = async (col: string) => {
    setSelectedAccent(col);
    document.documentElement.style.setProperty('--color-accent', col);
    document.documentElement.style.setProperty('--flowcus-accent', col);

    if (typeof window !== 'undefined' && window.electronAPI?.saveSetting) {
      setIsSaving(true);
      setErrorBanner('');
      try {
        const res = await window.electronAPI.saveSetting('accentColor', col);
        if (res?.success) {
          setSuccessBanner('Accent theme saved');
          setTimeout(() => setSuccessBanner(''), 2500);
        } else {
          setErrorBanner('Failed to save accent color');
        }
      } catch {
        setErrorBanner('Failed to save accent color');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleScale = async (val: number) => {
    setScale(val);
    if (typeof window !== 'undefined' && window.electronAPI?.saveSetting) {
      setIsSaving(true);
      setErrorBanner('');
      try {
        const res = await window.electronAPI.saveSetting('scaleFactor', val);
        if (res?.success) {
          setSuccessBanner(`Scale set to ${Math.round(val * 100)}%`);
          setTimeout(() => setSuccessBanner(''), 2500);
        } else {
          setErrorBanner('Failed to update scale');
        }
      } catch {
        setErrorBanner('Failed to update scale');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="manager-customize-view">
      <div className="settings-header">
        <h1 className="settings-title">Customize</h1>
        <p className="settings-subtitle">Personalize your desktop widget visual accents, sounds, and display properties.</p>
        {successBanner && (
          <div className="settings-save-pill" role="status">
            ✓ {successBanner}
          </div>
        )}
        {errorBanner && (
          <div className="settings-error-pill" role="alert" style={{ color: '#ff5252', marginTop: '6px', fontSize: '13px' }}>
            ⚠ {errorBanner}
          </div>
        )}
      </div>

      <div className="settings-cards-stack">
        {/* Accent Color Picker (Audit 16) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Accent Theme Color</span>
            <span className="row-desc">Select the primary glowing accent color used across desktop widgets and timers</span>
          </div>
          <div className="row-control">
            <div className="color-swatches-row">
              {accents.map(acc => (
                <button
                  key={acc.color}
                  type="button"
                  className={`color-swatch-circle ${selectedAccent === acc.color ? 'active' : ''}`}
                  style={{ backgroundColor: acc.color }}
                  onClick={() => handleAccentChange(acc.color)}
                  disabled={isSaving}
                  title={acc.name}
                  aria-label={acc.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Real-time Widget Scale (Audit 12) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Desktop Widget Scale</span>
            <span className="row-desc">Currently {Math.round(scale * 100)}% of native resolution</span>
          </div>
          <div className="row-control">
            <div className="scale-segmented-control">
              {[0.85, 1.0, 1.15].map(sc => (
                <button
                  key={sc}
                  type="button"
                  className={`scale-segment-btn ${scale === sc ? 'active' : ''}`}
                  disabled={isSaving}
                  onClick={() => handleScale(sc)}
                >
                  {Math.round(sc * 100)}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audio Test Bench */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Tactile Audio Sound Bench</span>
            <span className="row-desc">Test the synthesized Web Audio effects for clicks, page flips, and paper tearing</span>
          </div>
          <div className="row-control">
            <div className="audio-test-buttons-row">
              <button
                type="button"
                className="audio-test-btn"
                onClick={() => uwidgetsAudio.playTileClick()}
              >
                🔊 Flip Click
              </button>
              <button
                type="button"
                className="audio-test-btn"
                onClick={() => uwidgetsAudio.playPageFlip()}
              >
                📖 Page Flip
              </button>
              <button
                type="button"
                className="audio-test-btn"
                onClick={() => uwidgetsAudio.playPaperTear()}
              >
                ✂️ Paper Rip
              </button>
              <button
                type="button"
                className="audio-test-btn"
                onClick={() => uwidgetsAudio.playWinFanfare()}
              >
                🎉 Win Fanfare
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
