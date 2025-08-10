import { create } from 'zustand';
import { upsertProgress, readProgress } from '@/src/offline/storage';

type ProgressState = {
  lastModuleId?: string | null;
  todayCompleted: boolean;
  dailyGoal: number; // micro-modules/day
  currentStreak: number;
  longestStreak: number;
  setLastPosition: (moduleId: string, slideId: string, percent: number) => void;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export const useProgress = create<ProgressState>((set, get) => ({
  lastModuleId: null,
  todayCompleted: false,
  dailyGoal: 1,
  currentStreak: 0,
  longestStreak: 0,
  setLastPosition: (moduleId, slideId, percent) => {
    const now = new Date();
    upsertProgress({
      moduleId,
      lastSlideId: slideId,
      percent,
      completedAt: percent >= 1 ? now.toISOString() : null,
      timesReviewed: 0,
      updatedAt: now.toISOString(),
    });
    set({ lastModuleId: moduleId });
    if (percent >= 1) {
      const key = `goal_${todayKey()}`;
      if (!globalThis.localStorage?.getItem?.(key)) {
        try { globalThis.localStorage?.setItem?.(key, '1'); } catch {}
        set({ todayCompleted: true });
      }
    }
  },
}));

export function getModuleProgress(moduleId: string) {
  return readProgress(moduleId);
}


