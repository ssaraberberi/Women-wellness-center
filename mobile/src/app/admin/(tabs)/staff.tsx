import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, ErrorState, Header, Row, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { space } from '@/theme';

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'STAFF' | 'ADMIN';
  status: string;
  isOwner: boolean;
  staff: {
    isInstructor: boolean;
    isTherapist: boolean;
    active: boolean;
    bio: string | null;
    compensationModel: 'FIXED_SALARY' | 'HOURLY' | 'PER_CLASS';
    compensationRate: number;
    canViewClientNotes: boolean;
    qualifications: { id: string; name: string }[];
  } | null;
}

export default function AdminStaff() {
  const router = useRouter();
  const { t, tEnum } = useT();
  const q = useQuery({ queryKey: ['admin-staff'], queryFn: () => api<StaffRow[]>('GET', '/admin/staff') });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title={t('tabStaff')} right={<Button small icon="user-plus" title={t('invite')} onPress={() => router.push('/admin/staff-invite')} />} />
      {q.isPending ? (
        <SkeletonList count={5} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        q.data.map((s) => (
          <Card key={s.id} onPress={() => router.push({ pathname: '/admin/staff/[id]', params: { id: s.id } })} style={{ marginBottom: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{s.name}</Text>
                <Text variant="small">{s.email}</Text>
              </View>
              <Row style={{ flexWrap: 'wrap', maxWidth: '50%', justifyContent: 'flex-end' }}>
                {s.role === 'ADMIN' ? <Badge label={s.isOwner ? t('owner') : t('roleAdmin')} tone="wine" /> : null}
                {s.staff?.isInstructor ? <Badge label={t('isInstructor')} /> : null}
                {s.staff?.isTherapist ? <Badge label={t('isTherapist')} /> : null}
                {s.status !== 'ACTIVE' ? <Badge label={tEnum(s.status)} tone="warning" /> : null}
              </Row>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
