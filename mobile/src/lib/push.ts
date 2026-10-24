import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushStatus = 'registered' | 'denied' | 'unavailable' | 'error';

/** Expo Go on Android cannot receive remote push since SDK 53; a development build can. */
export const pushUnavailableInThisBuild = () =>
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let currentToken: string | null = null;

/** Ask once, register the token with the API. Never throws: no push is not an error. */
export async function registerForPush(): Promise<PushStatus> {
  try {
    if (!Device.isDevice || Platform.OS === 'web' || pushUnavailableInThisBuild()) return 'unavailable';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'DUA', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    currentToken = data;
    await api('POST', '/me/push-tokens', { body: { token: data, platform: Platform.OS } });
    return 'registered';
  } catch (e) {
    console.warn('[push] registration failed', e);
    return 'error';
  }
}

export async function unregisterPush() {
  if (!currentToken) return;
  try {
    await api('DELETE', '/me/push-tokens', { body: { token: currentToken } });
  } catch {
    /* signing out anyway */
  }
  currentToken = null;
}
