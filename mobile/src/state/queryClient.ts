import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 min
      gcTime: 1000 * 60 * 60, // 1 hour
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});


