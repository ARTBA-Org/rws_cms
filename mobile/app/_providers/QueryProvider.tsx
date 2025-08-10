import { PropsWithChildren, useEffect, useState } from 'react';
import { FocusAwareStatusBar } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-persist-client-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@/src/state/queryClient';

export function QueryProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Warm up filesystem for future downloads/prefetches
    FileSystem.getInfoAsync(FileSystem.cacheDirectory || '').finally(() => setReady(true));
  }, []);

  const persister = createAsyncStoragePersister({ storage: AsyncStorage });

  if (!ready) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <QueryClientProvider client={queryClient}>
        <FocusAwareStatusBar style="auto" />
        {children}
      </QueryClientProvider>
    </PersistQueryClientProvider>
  );
}


