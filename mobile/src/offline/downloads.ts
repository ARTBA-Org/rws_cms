import * as FileSystem from 'expo-file-system';
import { downloadAsset } from './prefetch';
import { readDownload, setDownload } from './storage';

export type ModuleAssetsMap = Record<string, string>; // remoteUrl -> localUri

const MODULE_DIR = `${FileSystem.documentDirectory}modules`;

export async function prefetchModuleAssets(moduleId: string, imageUrls: string[]): Promise<ModuleAssetsMap> {
  const targetDir = `${MODULE_DIR}/${moduleId}`;
  const existing = readDownload(moduleId);
  const prevMap: ModuleAssetsMap = existing ? JSON.parse(existing.assetsJson || '{}') : {};
  const map: ModuleAssetsMap = { ...prevMap };
  setDownload({ moduleId, status: 'downloading', bytesTotal: 0, bytesDownloaded: 0, assetsJson: JSON.stringify(map) });
  for (const url of imageUrls.filter(Boolean)) {
    try {
      if (map[url]) continue;
      const local = await downloadAsset(url, targetDir);
      map[url] = local;
      setDownload({ moduleId, status: 'downloading', bytesTotal: 0, bytesDownloaded: 0, assetsJson: JSON.stringify(map) });
    } catch {
      // ignore individual failures
    }
  }
  setDownload({ moduleId, status: 'completed', bytesTotal: 0, bytesDownloaded: 0, assetsJson: JSON.stringify(map) });
  return map;
}

export function getModuleAssets(moduleId: string): ModuleAssetsMap {
  const d = readDownload(moduleId);
  if (!d) return {};
  try { return JSON.parse(d.assetsJson || '{}') as ModuleAssetsMap; } catch { return {}; }
}


