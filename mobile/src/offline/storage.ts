import * as SQLite from 'expo-sqlite';

export type ProgressRow = {
  moduleId: string;
  lastSlideId?: string | null;
  percent: number;
  completedAt?: string | null;
  timesReviewed: number;
  updatedAt: string;
};

export type DownloadRow = {
  moduleId: string;
  status: 'none' | 'queued' | 'downloading' | 'completed' | 'error';
  bytesTotal: number;
  bytesDownloaded: number;
  assetsJson: string; // JSON array of file paths
};

const db = SQLite.openDatabaseSync('rws_micro.db');

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS progress (
      moduleId TEXT PRIMARY KEY,
      lastSlideId TEXT,
      percent REAL NOT NULL DEFAULT 0,
      completedAt TEXT,
      timesReviewed INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS downloads (
      moduleId TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      bytesTotal INTEGER NOT NULL DEFAULT 0,
      bytesDownloaded INTEGER NOT NULL DEFAULT 0,
      assetsJson TEXT NOT NULL DEFAULT '[]'
    );
  `);
}

export function upsertProgress(p: ProgressRow) {
  db.runSync(
    `INSERT INTO progress (moduleId, lastSlideId, percent, completedAt, timesReviewed, updatedAt)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(moduleId) DO UPDATE SET lastSlideId=excluded.lastSlideId, percent=excluded.percent, completedAt=excluded.completedAt, timesReviewed=excluded.timesReviewed, updatedAt=excluded.updatedAt`,
    [p.moduleId, p.lastSlideId ?? null, p.percent, p.completedAt ?? null, p.timesReviewed, p.updatedAt]
  );
}

export function readProgress(moduleId: string): ProgressRow | null {
  const r = db.getFirstSync<any>(`SELECT * FROM progress WHERE moduleId=?`, [moduleId]);
  return r || null;
}

export function listProgress(): ProgressRow[] {
  const r = db.getAllSync<any>(`SELECT * FROM progress ORDER BY updatedAt DESC`);
  return r as ProgressRow[];
}

export function setDownload(d: DownloadRow) {
  db.runSync(
    `INSERT INTO downloads (moduleId, status, bytesTotal, bytesDownloaded, assetsJson) VALUES (?,?,?,?,?)
     ON CONFLICT(moduleId) DO UPDATE SET status=excluded.status, bytesTotal=excluded.bytesTotal, bytesDownloaded=excluded.bytesDownloaded, assetsJson=excluded.assetsJson`,
    [d.moduleId, d.status, d.bytesTotal, d.bytesDownloaded, d.assetsJson]
  );
}

export function readDownload(moduleId: string): DownloadRow | null {
  return db.getFirstSync<any>(`SELECT * FROM downloads WHERE moduleId=?`, [moduleId]) || null;
}

export function listDownloads(): DownloadRow[] {
  return db.getAllSync<any>(`SELECT * FROM downloads`) as DownloadRow[];
}


