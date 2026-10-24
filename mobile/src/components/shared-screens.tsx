import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { whenShort } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { pushUnavailableInThisBuild, registerForPush, type PushStatus } from '@/lib/push';
import { loadMe, signOut } from '@/lib/session';
import type { NotificationItem } from '@/lib/types';
import { colors, space } from '@/theme';
import { Badge, Button, EmptyState, ErrorState, Field, Gap, Header, ListRow, Notice, Row, Screen, SkeletonList, Text, ToggleRow, type IconName } from './ui';

export function ProfileScreen({ links, base }: { links: { icon: IconName; label: string; href: Href }[]; base: '/client' | '/staff' | '/admin' }) {
  const router = useRouter();
  const { t, lang } = useT();
  const me = useAuth((s) => s.me);
  const setLang = useAuth((s) => s.setLang);
  const qc = useQueryClient();
  const name = me?.profile ? `${me.profile.firstName} ${me.profile.lastName}`.trim() : me?.email;

  const switchLang = async () => {
    const next = lang === 'sq' ? 'en' : 'sq';
    setLang(next);
    try {
      await api('PATCH', '/me/profile', { body: { language: next } });
      await loadMe();
      void qc.invalidateQueries();
    } catch {
      /* the local choice stands */
    }
  };

  return (
    <Screen>
      <Header title={t('profile')} />
      <Row gap={space.lg} style={{ marginBottom: space.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.wine, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="title" style={{ color: colors.white }}>{(me?.profile?.firstName ?? me?.email ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title" style={{ fontSize: 22 }}>{name}</Text>
          <Text variant="small">{me?.email}</Text>
          {me?.profile?.phone ? <Text variant="small">{me.profile.phone}</Text> : null}
          <Row style={{ marginTop: 4 }}>
            {me?.role !== 'CLIENT' ? <Badge label={me?.role === 'ADMIN' ? (me.isOwner ? t('owner') : t('roleAdmin')) : me?.staff?.isTherapist ? t('isTherapist') : t('isInstructor')} tone="wine" /> : null}
          </Row>
        </View>
      </Row>
      <ListRow icon="user" label={t('myDetails')} onPress={() => router.push(`${base}/details` as Href)} />
      {links.map((l) => (
        <ListRow key={l.label} icon={l.icon} label={l.label} onPress={() => router.push(l.href)} />
      ))}
      <ListRow icon="bell" label={t('notificationPrefs')} onPress={() => router.push(`${base}/preferences` as Href)} />
      <ListRow icon="globe" label={t('language')} value={lang === 'sq' ? 'Shqip' : 'English'} onPress={switchLang} />
      <Gap h={space.lg} />
      <ListRow icon="log-out" label={t('signOut')} danger onPress={() => void signOut()} />
      {me?.role === 'CLIENT' ? (
        <ListRow
          icon="trash-2"
          label={t('deleteAccount')}
          danger
          onPress={() =>
            Alert.alert(t('deleteAccount'), t('deleteConfirm'), [
              { text: t('keep'), style: 'cancel' },
              {
                text: t('confirm'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api('POST', '/me/deletion-request', { body: {} });
                    await signOut();
                  } catch (e) {
                    Alert.alert('DUA', errorText(e, lang));
                  }
                },
              },
            ])
          }
        />
      ) : null}
      <Gap h={space.xl} />
      <Text variant="caption" center>DUA Pilates & SPA · Rruga Anton Lufi, Komuna e Parisit, Tiranë · @dua_pilates_spa</Text>
    </Screen>
  );
}

export function DetailsScreen() {
  const { t, lang } = useT();
  const me = useAuth((s) => s.me);
  const [firstName, setFirst] = useState(me?.profile?.firstName ?? '');
  const [lastName, setLast] = useState(me?.profile?.lastName ?? '');
  const [phone, setPhone] = useState(me?.profile?.phone ?? '');
  const save = useMutation({
    mutationFn: () => api('PATCH', '/me/profile', { body: { firstName: firstName.trim(), lastName: lastName.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) } }),
    onSuccess: async () => {
      await loadMe();
      Alert.alert(t('saved'));
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen footer={<Button title={t('save')} onPress={() => save.mutate()} loading={save.isPending} disabled={!firstName.trim()} />}>
      <Header title={t('myDetails')} back />
      <Field label={t('firstName')} value={firstName} onChangeText={setFirst} />
      <Field label={t('lastName')} value={lastName} onChangeText={setLast} />
      <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={t('email')} value={me?.email ?? ''} editable={false} style={{ color: colors.muted }} />
    </Screen>
  );
}

export function PreferencesScreen() {
  const { t, lang } = useT();
  const me = useAuth((s) => s.me);
  const [prefs, setPrefs] = useState(me?.notificationPrefs ?? { pushEnabled: true, emailEnabled: true, reminders: true, waitlist: true, marketing: false });
  const [push, setPush] = useState<PushStatus | null>(null);
  useEffect(() => {
    if (prefs.pushEnabled) void registerForPush().then(setPush);
  }, [prefs.pushEnabled]);

  const update = async (patch: Partial<typeof prefs>) => {
    const prev = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      await api('PATCH', '/me/notification-preferences', { body: patch });
      await loadMe();
    } catch (e) {
      setPrefs(prev);
      Alert.alert('DUA', errorText(e, lang));
    }
  };

  return (
    <Screen>
      <Header title={t('notificationPrefs')} back />
      {pushUnavailableInThisBuild() ? <Notice tone="warning" text={t('pushUnavailable')} /> : push === 'denied' ? <Notice tone="warning" text={t('pushDenied')} /> : null}
      <Gap h={space.sm} />
      <ToggleRow label={t('pushNotifications')} value={prefs.pushEnabled} onChange={(v) => update({ pushEnabled: v })} />
      <ToggleRow label={t('emailNotifications')} value={prefs.emailEnabled} onChange={(v) => update({ emailEnabled: v })} />
      {me?.role === 'CLIENT' ? (
        <>
          <ToggleRow label={t('reminders')} value={prefs.reminders} onChange={(v) => update({ reminders: v })} />
          <ToggleRow label={t('waitlistAlerts')} value={prefs.waitlist} onChange={(v) => update({ waitlist: v })} />
          <ToggleRow label={t('marketing')} value={prefs.marketing} onChange={(v) => update({ marketing: v })} />
        </>
      ) : null}
      <Gap h={space.md} />
      <Text variant="small">{t('essentialNote')}</Text>
    </Screen>
  );
}

export function NotificationsScreen({ back = true, onOpen }: { back?: boolean; onOpen?: (n: NotificationItem) => void }) {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => api<{ unread: number; items: NotificationItem[] }>('GET', '/me/notifications?limit=100') });
  const readAll = useMutation({
    mutationFn: () => api('POST', '/me/notifications/read', { body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return (
    <Screen scroll={false}>
      <Header
        title={t('notifications')}
        back={back}
        right={q.data?.unread ? <Button small variant="ghost" title={t('markAllRead')} onPress={() => readAll.mutate()} /> : undefined}
      />
      {q.isPending ? (
        <SkeletonList count={6} height={64} />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.wine} />}
          ListEmptyComponent={<EmptyState icon="bell" title={t('noNotifications')} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpen?.(item)} style={{ paddingVertical: space.md, borderBottomWidth: 0.5, borderBottomColor: colors.line, flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: item.readAt ? 'transparent' : colors.wine }} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{item.title}</Text>
                <Text variant="small" style={{ color: colors.inkSoft }}>{item.body}</Text>
                <Text variant="caption" style={{ marginTop: 2 }}>{whenShort(item.createdAt, lang)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
