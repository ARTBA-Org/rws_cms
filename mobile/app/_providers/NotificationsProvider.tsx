
import { PropsWithChildren, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;
        const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
        if (!projectId) return;
        const t = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        setToken(t);
      }
    })();
  }, []);

  return children as any;
}
