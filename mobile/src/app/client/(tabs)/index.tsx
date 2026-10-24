import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, ErrorState, Gap, IconButton, Notice, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, lek, whenShort } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { photo } from '@/lib/images';
import { loc, type SessionDto, type Treatment } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

interface Home {
  firstName: string;
  nextClass: { bookingId: string; session: SessionDto } | null;
  nextSpa: { id: string; startsAt: string; treatment: { name: string; nameEn: string | null; imageKey: string | null }; room: string; therapist: string } | null;
  membership: { name: string; expiresAt: string; remainingCredits: number; totalCredits: number; spa: { name: string; remaining: number }[] } | null;
  pendingOrders: number;
  featured: SessionDto[];
  treatments: Treatment[];
  announcements: { id: string; title: string; titleEn: string | null; body: string; bodyEn: string | null }[];
  offers: { id: string; title: string; titleEn: string | null; body: string; bodyEn: string | null }[];
}

export default function ClientHome() {
  const router = useRouter();
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['home'], queryFn: () => api<Home>('GET', '/me/home') });
  const unread = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ unread: number }>('GET', '/me/notifications?limit=1') });
  const h = q.data;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{t('hello', { name: h?.firstName ?? '' })}</Text>
          <Text variant="body">{t('helloSub')}</Text>
        </View>
        <IconButton name="bell" label={t('notifications')} badge={unread.data?.unread} onPress={() => router.push('/client/notifications')} />
      </Row>
      <Gap h={space.lg} />

      {q.isPending ? <SkeletonList count={3} height={96} /> : q.isError && !h ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : h ? (
        <>
          {h.pendingOrders > 0 ? (
            <>
              <Notice text={t('pendingOrder')} tone="warning" icon="clock" />
              <Gap h={space.md} />
            </>
          ) : null}

          {h.nextClass ? (
            <UpNext
              label={t('nextClass')}
              title={loc(lang, h.nextClass.session.classType.name, h.nextClass.session.classType.nameEn)}
              line1={whenShort(h.nextClass.session.startsAt, lang)}
              line2={`${t('min', { n: h.nextClass.session.durationMin })} · ${h.nextClass.session.instructor?.name ?? ''}`}
              image={h.nextClass.session.classType.imageKey}
              onPress={() => router.push({ pathname: '/client/class/[id]', params: { id: h.nextClass!.session.id } })}
            />
          ) : null}
          {h.nextSpa ? (
            <UpNext
              label={t('nextSpa')}
              title={loc(lang, h.nextSpa.treatment.name, h.nextSpa.treatment.nameEn)}
              line1={whenShort(h.nextSpa.startsAt, lang)}
              line2={`${h.nextSpa.therapist} · ${h.nextSpa.room}`}
              image={h.nextSpa.treatment.imageKey}
              onPress={() => router.push('/client/classes')}
            />
          ) : null}

          {h.membership ? (
            <Card onPress={() => router.push('/client/memberships')} style={{ marginBottom: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption">{t('active').toUpperCase()}</Text>
                  <Text variant="heading" style={{ marginTop: 2 }}>{h.membership.name}</Text>
                  <Text variant="small">{t('expires', { date: dateShort(h.membership.expiresAt, lang) })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="title" style={{ color: colors.wine }}>{h.membership.remainingCredits}</Text>
                  <Text variant="small">{t('credits').toLowerCase()}</Text>
                </View>
              </Row>
              <View style={styles.progress}>
                <View style={[styles.progressFill, { width: `${h.membership.totalCredits ? (h.membership.remainingCredits / h.membership.totalCredits) * 100 : 0}%` }]} />
              </View>
              {h.membership.spa.length ? (
                <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
                  {h.membership.spa.map((s) => <Badge key={s.name} label={`${s.name} × ${s.remaining}`} tone="wine" />)}
                </Row>
              ) : null}
            </Card>
          ) : (
            <Card style={{ marginBottom: space.md, backgroundColor: colors.wine }}>
              <Text variant="title" style={{ color: colors.white }}>{t('noMembershipTitle')}</Text>
              <Text variant="body" style={{ color: colors.wineSoft, marginVertical: space.sm }}>{t('noMembershipBody')}</Text>
              <Button title={t('seePackages')} onPress={() => router.push('/client/packages')} textColor={colors.wine} style={{ backgroundColor: colors.white }} />
            </Card>
          )}

          <Gap h={space.sm} />
          <Button title={t('bookNow')} onPress={() => router.push('/client/book')} />

          <Section title={t('explore')}>
            <Row gap={space.md}>
              <ExploreTile label={t('pilates')} image="studio-reformers" onPress={() => router.push({ pathname: '/client/book', params: { tab: 'pilates' } })} />
              <ExploreTile label={t('spa')} image="massage-hands" onPress={() => router.push({ pathname: '/client/book', params: { tab: 'spa' } })} />
            </Row>
          </Section>

          {h.featured.length ? (
            <Section title={t('featured')}>
              {h.featured.map((s) => (
                <Card key={s.id} onPress={() => router.push({ pathname: '/client/class/[id]', params: { id: s.id } })} style={{ marginBottom: space.sm }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="heading">{loc(lang, s.classType.name, s.classType.nameEn)}</Text>
                      <Text variant="small">{whenShort(s.startsAt, lang)} · {s.instructor?.name}</Text>
                    </View>
                    <Badge label={s.available === 1 ? t('spot') : t('spots', { n: s.available })} />
                  </Row>
                </Card>
              ))}
            </Section>
          ) : null}

          {h.treatments.length ? (
            <Section title={t('spaTreatments')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                {h.treatments.map((tr) => (
                  <Pressable key={tr.id} style={{ width: 150 }} onPress={() => router.push({ pathname: '/client/treatment/[id]', params: { id: tr.id } })}>
                    <Image source={photo(tr.imageKey, 'massage-hands')} style={styles.thumb} contentFit="cover" />
                    <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: 6 }}>{loc(lang, tr.name, tr.nameEn)}</Text>
                    <Text variant="small">{t('min', { n: tr.durationMin })} · {lek(tr.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {h.offers.length ? (
            <Section title={t('offers')}>
              {h.offers.map((o) => (
                <Card key={o.id} style={{ marginBottom: space.sm, backgroundColor: colors.wineSoft }}>
                  <Text variant="heading" style={{ color: colors.wine }}>{loc(lang, o.title, o.titleEn)}</Text>
                  <Text variant="body">{loc(lang, o.body, o.bodyEn)}</Text>
                </Card>
              ))}
            </Section>
          ) : null}

          {h.announcements.length ? (
            <Section title={t('news')}>
              {h.announcements.map((a) => (
                <Card key={a.id} style={{ marginBottom: space.sm }}>
                  <Text variant="heading">{loc(lang, a.title, a.titleEn)}</Text>
                  <Text variant="body">{loc(lang, a.body, a.bodyEn)}</Text>
                </Card>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function UpNext({ label, title, line1, line2, image, onPress }: { label: string; title: string; line1: string; line2: string; image: string | null; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: space.md }}>
      <Text variant="small" style={{ color: colors.inkSoft, marginBottom: space.sm }}>{label}</Text>
      <Row gap={space.md}>
        <Image source={photo(image)} style={styles.upImg} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{title}</Text>
          <Text variant="small" style={{ color: colors.inkSoft }}>{line1}</Text>
          <Text variant="small">{line2}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.muted} />
      </Row>
    </Card>
  );
}

function ExploreTile({ label, image, onPress }: { label: string; image: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tile}>
      <Image source={photo(image)} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.tileShade} />
      <Row style={{ justifyContent: 'space-between', padding: space.md }}>
        <Text variant="heading" style={{ color: colors.white, fontFamily: fonts.semibold }}>{label}</Text>
        <Feather name="chevron-right" size={18} color={colors.white} />
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  upImg: { width: 64, height: 64, borderRadius: radius.md },
  progress: { height: 6, borderRadius: 3, backgroundColor: colors.sand, marginTop: space.md, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.wine },
  tile: { flex: 1, height: 120, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  tileShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,14,10,0.25)' },
  thumb: { width: 150, height: 110, borderRadius: radius.md },
});
