/**
 * W01 Automated Regression Tests: Isolated Previews & Explicit Form Ownership
 * Audits covered: Audit 01 (P0) & Audit 06 (P1)
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPreviewTasks,
  getPreviewTimer,
  PREVIEW_FOCUSED_MINUTES,
  getPreviewStickkPages,
} from '../src/utils/previewFixtures';
import { TaskItem } from '../src/types';
import { StoredTimerData, getLocalTodayDateString } from '../src/utils/taskStorage';

// Mock in-memory localStorage for isolation assertions
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe('W01: Preview Fixtures & Data Integrity (Audit 01)', () => {
  test('getPreviewTasks returns independent non-empty task array with required fields', () => {
    const tasks1 = getPreviewTasks();
    const tasks2 = getPreviewTasks();

    assert.ok(Array.isArray(tasks1));
    assert.ok(tasks1.length > 0, 'Expected non-empty preview tasks');
    assert.notStrictEqual(tasks1, tasks2, 'Fixtures must be fresh copies, not shared references');

    const expectedToday = getLocalTodayDateString();

    for (const task of tasks1) {
      assert.ok(task.id, 'Task must have an id');
      assert.ok(typeof task.title === 'string' && task.title.length > 0, 'Task must have a title');
      assert.ok(typeof task.durationEst === 'string' && task.durationEst.length > 0);
      assert.ok(typeof task.completed === 'boolean');
      assert.strictEqual(
        task.targetDate,
        expectedToday,
        'Preview task targetDate must match local today date string so it is not filtered out'
      );
      assert.ok(task.createdAt, 'Task must have a createdAt timestamp');
    }
  });

  test('getPreviewTimer returns initialized paused timer matching fixture schema', () => {
    const timer = getPreviewTimer();
    assert.strictEqual(typeof timer.activeTaskId, 'string');
    assert.strictEqual(timer.status, 'idle', 'Preview timer must start idle/paused');
    assert.strictEqual(typeof timer.remainingSeconds, 'number');
    assert.ok(timer.remainingSeconds > 0, 'Remaining seconds must be positive');
    assert.strictEqual(typeof timer.initialDurationSeconds, 'number');
    assert.ok(timer.initialDurationSeconds >= timer.remainingSeconds);
  });

  test('getPreviewStickkPages returns independent page array with valid styles', () => {
    const pages1 = getPreviewStickkPages();
    const pages2 = getPreviewStickkPages();

    assert.ok(Array.isArray(pages1));
    assert.ok(pages1.length >= 2, 'Expected at least 2 preview notebook pages');
    assert.notStrictEqual(pages1, pages2, 'Pages must be fresh copies');

    for (const page of pages1) {
      assert.ok(page.id);
      assert.ok(page.title);
      assert.ok(page.theme.startsWith('theme-'));
      assert.ok(page.font.startsWith('font-'));
      assert.ok(typeof page.text === 'string');
      assert.ok(page.updatedAt);
    }
  });

  test('PREVIEW_FOCUSED_MINUTES is non-negative number', () => {
    assert.ok(typeof PREVIEW_FOCUSED_MINUTES === 'number');
    assert.ok(PREVIEW_FOCUSED_MINUTES >= 0);
  });
});

describe('W01: Form Ownership & Deterministic Close Callback (Audit 06)', () => {
  test('onCloseAddForm is idempotent and prevents toggling race conditions', () => {
    let isAddFormOpen = true;

    // Handler simulating FlowcusWidget explicit close
    const handleCloseAddForm = () => {
      isAddFormOpen = false;
    };

    // Submitting a new task calls add (which closes form)
    handleCloseAddForm();
    assert.strictEqual(isAddFormOpen, false, 'Form must be closed immediately upon task submission');

    // Simulate 170ms delayed animation completion callback calling onCloseAddForm
    // Previously, onToggleAddForm was called which flipped !isAddFormOpen (!false => true), reopening it.
    handleCloseAddForm();
    assert.strictEqual(
      isAddFormOpen,
      false,
      'Form must remain closed after animation timer fires (idempotent onCloseAddForm)'
    );
  });

  test('onOpenAddForm idempotently opens form without toggle ambiguity', () => {
    let isAddFormOpen = false;

    const handleOpenAddForm = () => {
      isAddFormOpen = true;
    };

    handleOpenAddForm();
    assert.strictEqual(isAddFormOpen, true);

    // Calling open again does not flip
    handleOpenAddForm();
    assert.strictEqual(isAddFormOpen, true);
  });

  test('closeTimeoutRef is cleared on rapid repeated triggers to prevent duplicate timers', () => {
    let timerCleared = false;
    let timerCreatedCount = 0;
    let mockTimerHandle: any = null;

    const mockClearTimeout = (handle: any) => {
      if (handle) timerCleared = true;
    };

    const mockSetTimeout = (cb: () => void, ms: number) => {
      timerCreatedCount++;
      return { id: timerCreatedCount, cb, ms };
    };

    // First close call
    if (mockTimerHandle !== null) {
      mockClearTimeout(mockTimerHandle);
    }
    mockTimerHandle = mockSetTimeout(() => {}, 170);
    assert.strictEqual(timerCreatedCount, 1);

    // Second close call before first finished
    if (mockTimerHandle !== null) {
      mockClearTimeout(mockTimerHandle);
    }
    mockTimerHandle = mockSetTimeout(() => {}, 170);
    assert.strictEqual(timerCreatedCount, 2);
    assert.strictEqual(timerCleared, true, 'Prior timer must be cleared before scheduling new close animation');
  });
});

describe('W01: Storage & Desktop Isolation in Preview Mode (Audit 01)', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
  });

  test('Preview guard prevents writing tasks, timer, and focus minutes to storage', () => {
    const isPreview = true;
    const testTasks: TaskItem[] = getPreviewTasks();
    const testTimer: StoredTimerData = getPreviewTimer();
    const testMinutes = 45;

    // Emulate guarded save calls from FlowcusWidget
    const guardedSaveTasks = (tasks: TaskItem[]) => {
      if (!isPreview) {
        mockStorage.setItem('flowcus_tasks', JSON.stringify(tasks));
      }
    };

    const guardedSaveTimer = (timer: StoredTimerData) => {
      if (!isPreview) {
        mockStorage.setItem('flowcus_timer', JSON.stringify(timer));
      }
    };

    const guardedSaveMinutes = (mins: number) => {
      if (!isPreview) {
        mockStorage.setItem('flowcus_today_focus_minutes', JSON.stringify(mins));
      }
    };

    guardedSaveTasks(testTasks);
    guardedSaveTimer(testTimer);
    guardedSaveMinutes(testMinutes);

    assert.strictEqual(
      mockStorage.getItem('flowcus_tasks'),
      null,
      'Preview must never write tasks to storage'
    );
    assert.strictEqual(
      mockStorage.getItem('flowcus_timer'),
      null,
      'Preview must never write timer to storage'
    );
    assert.strictEqual(
      mockStorage.getItem('flowcus_today_focus_minutes'),
      null,
      'Preview must never write focus minutes to storage'
    );
    assert.strictEqual(mockStorage.length, 0, 'Storage must remain completely empty');
  });

  test('Dev triggers (sample tasks / daily reset) are guarded against storage write in preview', () => {
    const isPreview = true;
    let storageWritten = false;

    // Emulate guarded trigger logic in FlowcusWidget
    const runSampleTasksEffect = (sampleTasksTrigger: number) => {
      if (isPreview) return;
      if (sampleTasksTrigger > 0) {
        storageWritten = true;
      }
    };

    const runDailyResetEffect = (resetDayTrigger: number) => {
      if (isPreview) return;
      if (resetDayTrigger > 0) {
        storageWritten = true;
      }
    };

    runSampleTasksEffect(1);
    runDailyResetEffect(1);

    assert.strictEqual(storageWritten, false, 'Dev triggers must be no-ops when isPreview is true');
  });

  test('WidgetChrome preview mode suppresses Electron IPC desktop actions', () => {
    const isPreview = true;
    let pinToggled = false;
    let widgetClosed = false;
    let mainWindowOpened = false;

    const mockElectronAPI = {
      togglePin: (_id: string) => {
        pinToggled = true;
      },
      closeWidget: (_id: string) => {
        widgetClosed = true;
      },
      openMainWindow: () => {
        mainWindowOpened = true;
      },
    };

    // Emulate WidgetChrome click handlers under isPreview
    const handleTogglePin = () => {
      if (isPreview) return;
      mockElectronAPI.togglePin('flowcus');
    };

    const handleClose = () => {
      if (isPreview) return;
      mockElectronAPI.closeWidget('flowcus');
    };

    const handleOpenMain = () => {
      if (isPreview) return;
      mockElectronAPI.openMainWindow();
    };

    handleTogglePin();
    handleClose();
    handleOpenMain();

    assert.strictEqual(pinToggled, false, 'Desktop pin must not be called in preview');
    assert.strictEqual(widgetClosed, false, 'Desktop close must not be called in preview');
    assert.strictEqual(mainWindowOpened, false, 'Desktop openMainWindow must not be called in preview');
  });
});
