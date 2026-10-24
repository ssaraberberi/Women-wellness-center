import { useRouter } from 'expo-router';
import { NotificationsScreen } from '@/components/shared-screens';

export default function StaffNotifications() {
  const router = useRouter();
  return (
    <NotificationsScreen
      back={false}
      onOpen={(n) => {
        if (n.data?.sessionId) router.push({ pathname: '/staff/session/[id]', params: { id: n.data.sessionId } });
        else if (n.data?.appointmentId) router.push({ pathname: '/staff/appointment/[id]', params: { id: n.data.appointmentId } });
        else if (n.data?.kind === 'staff-request') router.push('/staff/requests');
      }}
    />
  );
}