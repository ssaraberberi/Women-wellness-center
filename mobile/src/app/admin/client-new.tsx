import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Header, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';

/** A client added at the desk signs in later with her own email — no password ever exists. */
export default function NewClient() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '+355 ' });
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });
  const save = useMutation({
    mutationFn: () => api<{ id: string }>('POST', '/admin/clients', { body: { ...form, email: form.email.trim(), language: lang } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['admin-clients'] });
      router.replace({ pathname: '/admin/client/[id]', params: { id: r.id } });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen footer={<Button title={t('create')} onPress={() => save.mutate()} loading={save.isPending} disabled={!form.firstName || !form.email} />}>
      <Header title={t('newClient')} back />
      <Field label={t('firstName')} value={form.firstName} onChangeText={set('firstName')} />
      <Field label={t('lastName')} value={form.lastName} onChangeText={set('lastName')} />
      <Field label={t('email')} value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Field label={t('phone')} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
    </Screen>
  );
}
