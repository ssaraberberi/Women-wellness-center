/* ============================================================
   Notifications on the phone, two kinds
   ------------------------------------------------------------
   Pushed: whatever the studio's server writes as a notice — a class
   moved, a reservation confirmed — arrives on the lock screen too. The
   phone's Expo push address is handed to the server at sign-in and taken
   back at sign-out.

   Local: a reminder before each class she has booked, scheduled on the
   phone itself from her own bookings. No server, nothing to send; it is
   rebuilt every time her bookings are read, so a cancelled class takes
   its reminder with it.
   ============================================================ */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { post } from './api';
import { translate, getLang } from './i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false
  })
});

let pushToken: string | null = null;

async function permitted(ask: boolean) {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DUA', importance: Notifications.AndroidImportance.HIGH, lightColor: '#7D2F49'
    }).catch(() => {});
  const now = await Notifications.getPermissionsAsync();
  if (now.granted || !ask) return now.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/* Asks once, after sign-in. A refusal is respected: the notices are still
   in the app, under the bell. */
export async function registerForPush() {
  try {
    if (!Device.isDevice || !(await permitted(true))) return;
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return;                         // not linked to EAS yet: `eas init` adds it
    pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await post('/api/me/devices', { token: pushToken, platform: Platform.OS, lang: getLang() });
  } catch (e) {
    console.warn('push registration skipped', e);
  }
}

export async function forgetPush() {
  if (!pushToken) return;
  await post('/api/me/devices/forget', { token: pushToken }).catch(() => {});
  pushToken = null;
}

/* ---------- reminders before a class ---------- */
const REMIND_MIN = 120;

export type Upcoming = { id: string; startsAt: Date; title: string; time: string };

export async function scheduleReminders(classes: Upcoming[]) {
  try {
    if (!(await permitted(false))) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled)
      if ((n.content.data as any)?.kind === 'reminder')
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
    const lang = getLang();
    const soon = Date.now();
    for (const c of classes.slice(0, 30)) {
      const when = c.startsAt.getTime() - REMIND_MIN * 60000;
      if (when <= soon) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'DUA',
          body: translate(lang, '%s today at %s. See you soon.', c.title, c.time),
          data: { kind: 'reminder', classId: c.id }
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(when), channelId: 'default' }
      });
    }
  } catch (e) {
    console.warn('reminders not scheduled', e);
  }
}

export async function clearReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
