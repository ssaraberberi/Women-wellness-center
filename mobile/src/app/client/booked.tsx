import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Gap, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { longDate, time } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type SessionDetail } from '@/lib/types';
import { colors, radius, space } from '@/theme';

/** "Rezervimi u krye": what was booked, and a way to put it in the phone's calendar. */
export default function Booked() {
  const { kind, sessionId, title, startsAt, endsAt, subtitle, image } = useLocalSearchParams<{
    kind: 'class' | 'spa';
    sessionId?: string;
    title?: string;
    startsAt?: string;
    endsAt?: string;
    subtitle?: string;
    image?: string;
  }>();
  const router = useRouter();
  const { t, lang } = useT();
  const [added, setAdded] = useState(false);
  const q = useQuery({ queryKey: ['session', sessionId], queryFn: () => api<SessionDetail>('GET', `/sessions/${sessionId}`), enabled: kind === 'class' && !!sessionId });

  const item =
    kind === 'class' && q.data
      ? { title: loc(lang, q.data.classType.name, q.data.classType.nameEn), startsAt: q.data.startsAt, endsAt: q.data.endsAt, lines: [q.data.instructor?.name ?? '', 'Studio DUA'], image: q.data.classType.imageKey }
      : startsAt
        ? { title: title ?? '', startsAt, endsAt: endsAt ?? startsAt, lines: [subtitle ?? ''], image: image ?? 'massage-hands' }
        : null;

  const addToCalendar = async () => {
    if (!item) return;
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') return;
      const cal =
        Platform.OS === 'ios'
          ? await Calendar.getDefaultCalendarAsync()
          : (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).find((c) => c.allowsModifications && c.isPrimary) ??
            (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).find((c) => c.allowsModifications);
      if (!cal) return;
      await Calendar.createEventAsync(cal.id, {
        title: `DUA · ${item.title}`,
        startDate: new Date(item.startsAt),
        endDate: new Date(item.endsAt),
        location: 'DUA Pilates & SPA, Rruga Anton Lufi, Komuna e Parisit, Tiranë',
        timeZone: 'Europe/Tirane',
        alarms: [{ relativeOffset: -120 }],
      });
      setAdded(true);
    } catch (e) {
      Alert.alert('DUA', String((e as Error).message ?? e));
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', marginTop: space.xxxl }}>
        <View style={styles.check}>
          <Feather name="check" size={34} color={colors.wine} />
        </View>
        <Gap h={space.lg} />
        <Text variant="display" center>
          {kind === 'spa' ? t('spaDone') : t('bookingDone')}
        </Text>
        <Text variant="body" center style={{ marginTop: space.sm }}>
          {t('bookingDoneSub')}
        </Text>
      </View>
      <Gap h={space.xxl} />
      {item ? (
        <Card>
          <Row gap={space.lg}>
            <Image source={photo(item.image)} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{item.title}</Text>
              <Text variant="small" style={{ color: colors.inkSoft }}>{longDate(item.startsAt, lang)}</Text>
              <Text variant="small" style={{ color: colors.inkSoft }}>{time(item.startsAt)} – {time(item.endsAt)}</Text>
              {item.lines.filter(Boolean).map((l) => (
                <Text key={l} variant="small">{l}</Text>
              ))}
            </View>
          </Row>
        </Card>
      ) : null}
      <Gap h={space.xxl} />
      <Button title={t('seeMyClasses')} onPress={() => router.replace('/client/classes')} />
      <Gap h={space.md} />
      <Button variant="secondary" icon={added ? 'check' : 'calendar'} title={added ? t('addedToCalendar') : t('addToCalendar')} onPress={addToCalendar} disabled={added || !item} />
      <Gap h={space.sm} />
      <Button variant="ghost" title={t('done')} onPress={() => router.replace('/client')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.wine, alignItems: 'center', justifyContent: 'center' },
  img: { width: 84, height: 96, borderRadius: radius.md },
});
