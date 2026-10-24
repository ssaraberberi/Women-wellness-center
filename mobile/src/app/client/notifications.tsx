import { useRouter } from 'expo-router';
import { NotificationsScreen } from '@/components/shared-screens';

export default function ClientNotifications() {
  const router = useRouter();
  return (
    <NotificationsScreen
      onOpen={(n) => {
        if (n.data?.sessionId) router.push({ pathname: '/client/class/[id]', params: { id: n.data.sessionId } });
        else if (n.data?.kind === 'purchase' || n.data?.kind === 'order') router.push('/client/memberships');
        else if (n.data?.kind === 'spa') router.push('/client/classes');
      }}
    />
  );
}