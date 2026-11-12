import { StickkPage, StickkExportData, StickkTheme, StickkFont } from '../types';

export const STICKK_STORAGE_KEY = 'uwidgets_stickk_pages_v1';
export const STICKK_TRASH_KEY = 'uwidgets_stickk_trash_v1';
export const STICKK_BACKUP_KEY = 'uwidgets_stickk_backup_v1';

export const ALLOWED_THEMES: StickkTheme[] = ['theme-yellow', 'theme-orange', 'theme-mint', 'theme-lavender', 'theme-dark'];
export const ALLOWED_FONTS: StickkFont[] = ['font-caveat', 'font-comic', 'font-gloria', 'font-pacifico', 'font-marker'];

export const SEED_STICKK_PAGES: StickkPage[] = [
  {
    id: 'page-1',
    title: 'Brainstorm & UI Ideas',
    theme: 'theme-yellow',
    font: 'font-caveat',
    text: '⚡ 1. Uwidgets: Pin tools anywhere on desktop\n⚡ 2. Playz: Minimax AI + Brush-stroke line\n⚡ 3. Stickk: Sketch, draw, and funky fonts!',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'page-2',
    title: 'Weekend Goals',
    theme: 'theme-mint',
    font: 'font-comic',
    text: '□ Clean desktop workspace\n□ Smooth 3D page flip\n□ Deploy and test Uwidgets.exe',
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'page-3',
    title: 'Quote to Remember',
    theme: 'theme-lavender',
    font: 'font-pacifico',
    text: '“Simplicity is about subtracting the obvious and adding the meaningful.”',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

/**
 * Validates note schema on the client.
 */
export function validateStickkPageClient(page: any): page is StickkPage {
  if (!page || typeof page !== 'object') return false;
  if (typeof page.id !== 'string' || page.id.trim().length === 0) return false;
  if (typeof page.title !== 'string') return false;
  if (!ALLOWED_THEMES.includes(page.theme)) return false;
  if (!ALLOWED_FONTS.includes(page.font)) return false;
  if (typeof page.text !== 'string') return false;
  if (page.strokes !== undefined && !Array.isArray(page.strokes)) return false;
  return true;
}

/**
 * Prunes trash items according to retention policy (30-day retention, max 50 items).
 */
export function pruneExpiredTrash(trash: StickkPage[], maxDays = 30, maxItems = 50): StickkPage[] {
  if (!Array.isArray(trash)) return [];
  const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;

  return trash
    .filter(item => {
      if (!item.deletedAt) return true;
      const t = new Date(item.deletedAt).getTime();
      return !isNaN(t) && t >= cutoffTime;
    })
    .slice(0, maxItems);
}

/**
 * Synchronous loader for initial React state, falling back to seed pages.
 */
export const loadStickkPages = (): StickkPage[] => {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STICKK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(validateStickkPageClient);
          if (valid.length > 0) return valid;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load Stickk pages from localStorage; falling back to seeds.', err);
  }

  // Backup seeds to localStorage
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STICKK_STORAGE_KEY, JSON.stringify(SEED_STICKK_PAGES));
    }
  } catch {}

  return JSON.parse(JSON.stringify(SEED_STICKK_PAGES));
};

/**
 * Synchronous loader for trash stack.
 */
export const loadStickkTrash = (): StickkPage[] => {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STICKK_TRASH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return pruneExpiredTrash(parsed.filter(validateStickkPageClient));
        }
      }
    }
  } catch {}
  return [];
};

/**
 * Asynchronous loader that reconciles with Electron durable storage when available.
 */
export async function loadStickkStateAsync(): Promise<{ pages: StickkPage[]; trash: StickkPage[] }> {
  if (typeof window !== 'undefined') {
    const api = window.electronAPI;
    if (api?.getStickkPages) {
      try {
        const res = await api.getStickkPages();
        if (res?.success !== false && Array.isArray(res.pages) && res.pages.length > 0) {
          return {
            pages: res.pages.filter(validateStickkPageClient),
            trash: Array.isArray(res.trash) ? pruneExpiredTrash(res.trash.filter(validateStickkPageClient)) : [],
          };
        }
      } catch (err) {
        console.warn('Electron getStickkPages failed, using local copy:', err);
      }
    }
  }

  return {
    pages: loadStickkPages(),
    trash: loadStickkTrash(),
  };
}

/**
 * Persists notes and trash both to Electron durable store and local cache.
 */
export async function saveStickkStateAsync(
  pages: StickkPage[],
  trash: StickkPage[] = []
): Promise<{ success: boolean; error?: string }> {
  const validPages = pages.filter(validateStickkPageClient);
  const validTrash = pruneExpiredTrash(trash.filter(validateStickkPageClient));

  // 1. Electron Durable Storage
  if (typeof window !== 'undefined') {
    const api = window.electronAPI;
    if (api?.saveStickkPages) {
      try {
        const res = await api.saveStickkPages({ pages: validPages, trash: validTrash });
        if (res && res.success === false) {
          return { success: false, error: res.error || 'Electron storage failed' };
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'IPC error' };
      }
    }

    // 2. Local Cache & Pre-Migration Backup
    try {
      localStorage.setItem(STICKK_STORAGE_KEY, JSON.stringify(validPages));
      localStorage.setItem(STICKK_TRASH_KEY, JSON.stringify(validTrash));
      // Keep last known good backup
      localStorage.setItem(STICKK_BACKUP_KEY, JSON.stringify({
        backedUpAt: new Date().toISOString(),
        pages: validPages,
      }));
    } catch (e: any) {
      console.warn('localStorage quota warning:', e);
    }
  }

  return { success: true };
}

/**
 * Legacy synchronous save function for backward compatibility.
 */
export const saveStickkPages = (pages: StickkPage[]): void => {
  saveStickkStateAsync(pages).catch(() => {});
};

/**
 * Export notes to formatted JSON file payload.
 */
export function exportStickkNotes(pages: StickkPage[], trash: StickkPage[] = []): string {
  const exportPayload: StickkExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    pages: pages.filter(validateStickkPageClient),
    trash: trash.filter(validateStickkPageClient),
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Validates and parses imported JSON string.
 */
export function importStickkNotesFromJson(jsonString: string): {
  success: boolean;
  pages?: StickkPage[];
  trash?: StickkPage[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Import file must be a valid JSON object.' };
    }

    const pagesArray = Array.isArray(parsed) ? parsed : parsed.pages;
    if (!Array.isArray(pagesArray) || pagesArray.length === 0) {
      return { success: false, error: 'Import payload must contain at least one note page.' };
    }

    const validPages: StickkPage[] = [];
    for (let i = 0; i < pagesArray.length; i++) {
      const item = pagesArray[i];
      if (validateStickkPageClient(item)) {
        validPages.push(item);
      } else {
        return { success: false, error: `Page at index ${i} is missing required note fields.` };
      }
    }

    const validTrash = Array.isArray(parsed.trash)
      ? parsed.trash.filter(validateStickkPageClient)
      : [];

    return {
      success: true,
      pages: validPages,
      trash: validTrash,
    };
  } catch (err: any) {
    return { success: false, error: `Invalid JSON syntax: ${err?.message || err}` };
  }
}
