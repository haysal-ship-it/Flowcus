export type ViewMode = 'tasks' | 'focus' | 'settings';
export type WindowWidthMode = 'mini340' | 'window480' | 'expanded';

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  durationEst: string;
  category?: string;
  inProgress?: boolean;
  targetDate: string; // YYYY-MM-DD local date
  createdAt: string;  // ISO timestamp
  completedAt?: string;
}

export interface DailyStats {
  completedTasks: number;
  totalTasks: number;
  focusMinutes: number;
  streakDays: number;
}
