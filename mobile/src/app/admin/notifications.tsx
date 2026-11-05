import { useRouter } from 'expo-router';
import { NotificationsScreen } from '@/components/shared-screens';

/** A booking or cancellation opens its class; a new client or a package reservation opens the client. */
export default function AdminNotifications() {
  const router = useRouter();
  return (
    <NotificationsScreen
      onOpen={(n) => {
        if (n.data?.sessionId) router.push({ pathname: '/admin/session/[id]', params: { id: String(n.data.sessionId) } });
        else if (n.data?.clientId) router.push({ pathname: '/admin/client/[id]', params: { id: String(n.data.clientId) } });
      }}
    />
  );
}
