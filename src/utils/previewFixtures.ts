import { TaskItem, StickkPage } from '../types';
import { StoredTimerData, getLocalTodayDateString } from './taskStorage';

/**
 * In-memory preview fixtures for Uwidgets Manager Detail Modal.
 * Completely decoupled from production localStorage and Electron desktop state.
 */

export const getPreviewTasks = (): TaskItem[] => {
  const today = getLocalTodayDateString();
  const now = new Date().toISOString();
  return [
    {
      id: 'preview-task-1',
      title: 'Review UI component states & tokens',
      completed: true,
      inProgress: false,
      durationEst: '25m',
      completedAt: '10:15 AM',
      targetDate: today,
      createdAt: now,
    },
    {
      id: 'preview-task-2',
      title: 'Calibrate desktop widget floating bounds',
      completed: false,
      inProgress: true,
      durationEst: '45m',
      targetDate: today,
      createdAt: now,
    },
    {
      id: 'preview-task-3',
      title: 'Prepare quarterly release milestone notes',
      completed: false,
      inProgress: false,
      durationEst: '30m',
      targetDate: today,
      createdAt: now,
    },
  ];
};

export const getPreviewTimer = (): StoredTimerData => ({
  status: 'idle',
  activeTaskId: 'preview-task-2',
  initialDurationSeconds: 1500,
  remainingSeconds: 1500,
  currentSession: 2,
  totalSessions: 4,
  targetEndTimeMs: null,
  lastUpdatedMs: Date.now(),
});

export const PREVIEW_FOCUSED_MINUTES = 45;

export const getPreviewStickkPages = (): StickkPage[] => [
  {
    id: 'preview-page-1',
    title: 'Brainstorm & UI Ideas',
    theme: 'theme-yellow',
    font: 'font-caveat',
    text: 'Welcome to Stickk Notes!\n\n• Switch fonts freely\n• Toggle ruled or blank paper\n• Freehand sketch with smooth ink\n• Realistic 3D page flip animation',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preview-page-2',
    title: 'Quick Reminders',
    theme: 'theme-mint',
    font: 'font-comic',
    text: 'Upcoming reminders:\n1. Verify desktop window placement\n2. Check Always-on-Top pin state',
    updatedAt: new Date().toISOString(),
  },
];
