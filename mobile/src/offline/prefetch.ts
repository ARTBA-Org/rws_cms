import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

export async function downloadAsset(url: string, targetDir: string) {
  await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true }).catch(() => {});
  const filename = url.split('?')[0].split('/').pop() || `${Date.now()}`;
  const target = `${targetDir}/${filename}`;
  const res = await FileSystem.downloadAsync(url, target, { cache: true });
  return res.uri;
}

export async function canPrefetch(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return !!state.isConnected && !!state.isInternetReachable;
}


