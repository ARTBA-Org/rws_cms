import * as Sentry from 'sentry-expo';
import { initDb } from '@/src/offline/storage';

export function initializeApp() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
    enableInExpoDevelopment: true,
    debug: false,
  });
  initDb();
}


