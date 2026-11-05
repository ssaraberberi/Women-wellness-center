import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MembershipCard, type MembershipPurchase } from '@/components/MembershipCard';
import { Badge, Button, Card, ErrorState, Gap, IconButton, Notice, Row, Screen, Section, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { SPA_ENABLED } from '@/lib/features';
import { affirmation } from '@/lib/affirmations';
import { lek, longDate, whenShort } from '@/lib/format';
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
  // Packages she holds now — active ones and ones waiting for payment at the studio.
  const mq = useQuery({ queryKey: ['memberships'], queryFn: () => api<{ purchases: MembershipPurchase[] }>('GET', '/me/memberships') });
  const current = (mq.data?.purchases ?? []).filter((p) => p.status === 'ACTIVE' || p.status === 'PENDING_PAYMENT');

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void mq.refetch(); }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: space.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow">{longDate(new Date(), lang)}</Text>
          <Text variant="display" style={{ marginTop: space.sm }}>{t('helloOnly')}</Text>
          <Text variant="display" style={{ fontFamily: fonts.displayItalic, color: colors.wine }}>{h?.firstName ?? ''} ✦</Text>
        </View>
        <IconButton name="bell" label={t('notifications')} badge={unread.data?.unread} onPress={() => router.push('/client/notifications')} />
      </Row>
      <Gap h={space.lg} />

      <View style={styles.note}>
        <Text variant="eyebrow" style={{ color: colors.wine }}>{t('todaysNote')}</Text>
        <Text variant="serifItalic" style={{ marginTop: 6, fontSize: 19, lineHeight: 27, color: colors.ink }}>“{affirmation(lang)}”</Text>
        <Text style={styles.noteFlourish}>❀</Text>
      </View>
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
          {SPA_ENABLED && h.nextSpa ? (
            <UpNext
              label={t('nextSpa')}
              title={loc(lang, h.nextSpa.treatment.name, h.nextSpa.treatment.nameEn)}
              line1={whenShort(h.nextSpa.startsAt, lang)}
              line2={`${h.nextSpa.therapist} · ${h.nextSpa.room}`}
              image={h.nextSpa.treatment.imageKey}
              onPress={() => router.push('/client/classes')}
            />
          ) : null}

          {current.length ? (
            <View style={{ marginBottom: space.sm }}>
              <Text variant="eyebrow" style={{ marginBottom: space.sm }}>{current.length > 1 ? t('myPackages') : t('myPackage')}</Text>
              {current.map((p) => (
                <MembershipCard key={p.id} p={p} onPress={() => router.push('/client/memberships')} />
              ))}
            </View>
          ) : (
            <Card style={{ marginBottom: space.md, backgroundColor: colors.wine }}>
              <Text variant="title" style={{ color: colors.white }}>{t('noMembershipTitle')}</Text>
              <Text variant="body" style={{ color: colors.wineSoft, marginVertical: space.sm }}>{t('noMembershipBody')}</Text>
              <Button title={t('seePackages')} onPress={() => router.push('/client/packages')} textColor={colors.wine} style={{ backgroundColor: colors.white }} />
            </Card>
          )}

          <Gap h={space.sm} />
          <Button title={t('bookNow')} onPress={() => router.push('/client/book')} />

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

          {SPA_ENABLED && h.treatments.length ? (
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


const styles = StyleSheet.create({
  upImg: { width: 68, height: 84, borderRadius: radius.md },
  note: { backgroundColor: colors.blush, borderRadius: radius.xl, paddingVertical: space.xl, paddingHorizontal: space.xl, overflow: 'hidden' },
  noteFlourish: { position: 'absolute', right: 16, top: 10, fontSize: 30, color: colors.blushDeep },
  thumb: { width: 150, height: 190, borderRadius: radius.lg },
});
