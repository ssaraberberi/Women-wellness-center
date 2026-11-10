import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from '@/lib/alert';
import { Button, Field, Header, PhoneField, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useT } from '@/lib/i18n';
import { checkPhone } from '@/lib/phone';

/** A client added at the desk: she signs in with her email and the DUA-… code shown on her profile next. */
export default function NewClient() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });
  const phone = checkPhone(form.phone);
  const save = useMutation({
    mutationFn: () => api<{ id: string; password: string }>('POST', '/admin/clients', { body: { ...form, email: form.email.trim(), phone: phone!.e164, language: lang } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['admin-clients'] });
      router.replace({ pathname: '/admin/client/[id]', params: { id: r.id, code: r.password } });
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen footer={<Button title={t('create')} onPress={() => save.mutate()} loading={save.isPending} disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email || !phone} />}>
      <Header title={t('newClient')} back />
      <Field label={t('firstName')} value={form.firstName} onChangeText={set('firstName')} />
      <Field label={t('lastName')} value={form.lastName} onChangeText={set('lastName')} />
      <Field label={t('email')} value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <PhoneField label={t('phone')} value={form.phone} onChangeText={set('phone')} />
    </Screen>
  );
}
