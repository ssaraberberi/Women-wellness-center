/* One of her classes: who is coming, and — from half an hour before it
   starts — who came. The server only lets her read and mark her own. */
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { post } from '@/lib/api';
import { useData } from '@/lib/useData';
import { useT } from '@/lib/i18n';
import { longDate, startsAt } from '@/lib/format';
import { ErrorNote, Eyebrow, Loading, Screen, Title, st } from '@/components/ui';
import { Roster, type RosterRow } from '@/components/Roster';

export default function InstructorClass() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const state = useData<any>('/api/instructor/state');
  const roster = useData<RosterRow[]>('/api/instructor/classes/' + id + '/roster');
  if (state.loading || roster.loading) return <Loading />;
  const k = state.data?.classes.find((c: any) => c.id === id);
  if (!k) return <Screen><ErrorNote text={state.error || roster.error || 'No such class'} /></Screen>;
  const type = (state.data.classTypes.find((x: any) => x.id === k.typeId) || { name: k.typeId }).name;
  const canMark = startsAt(k.date, k.start).getTime() - 30 * 60000 <= Date.now();
  const rows = roster.data || [];

  const mark = async (bookingId: string, v: 'attended' | 'noshow' | null) => {
    await post('/api/instructor/bookings/' + bookingId + '/attendance', { attendance: v });
    roster.setData(rows.map(r => r.id === bookingId ? { ...r, attendance: v } : r));
  };

  return (
    <Screen refreshing={roster.refreshing} onRefresh={roster.reload}>
      <Title sub={longDate(k.date, lang, true) + ' · ' + k.start + '–' + k.end}>{t(type)}</Title>
      {k.cancelled ? <Text style={[st.body, { color: '#A12A2A' }]}>{t('This class was cancelled')}</Text> : null}
      <Eyebrow>Who is coming</Eyebrow>
      <Text style={[st.muted, { marginBottom: 8 }]}>
        {t('%s of %s places booked', rows.filter(r => r.status === 'booked').length, k.capacity)}
        {canMark ? '' : ' · ' + t('Attendance opens 30 minutes before the class.')}
      </Text>
      <ErrorNote text={roster.error} />
      <Roster rows={rows} onMark={mark} canMark={canMark && !k.cancelled} />
    </Screen>
  );
}
