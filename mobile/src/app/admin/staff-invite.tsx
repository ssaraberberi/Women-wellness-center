import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Chip, Field, Gap, Header, Notice, Row, Screen, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/theme';

/** The only way anyone becomes staff or admin: invited by email from here. */
export default function StaffInvite() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useT();
  const isOwner = useAuth((s) => !!s.me?.isOwner);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [isInstructor, setInstructor] = useState(true);
  const [isTherapist, setTherapist] = useState(false);
  const [owner, setOwner] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const invite = useMutation({
    mutationFn: () =>
      api('POST', '/admin/staff/invite', {
        body: { ...f, email: f.email.trim(), phone: f.phone.trim() || undefined, role, isInstructor, isTherapist, isOwner: role === 'ADMIN' && owner },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-staff'] });
      router.back();
    },
    onError: (e) => Alert.alert('DUA', errorText(e, lang)),
  });
  return (
    <Screen footer={<Button title={t('invite')} onPress={() => invite.mutate()} loading={invite.isPending} disabled={!f.firstName || !f.email} />}>
      <Header title={t('inviteStaff')} back />
      <Field label={t('firstName')} value={f.firstName} onChangeText={set('firstName')} />
      <Field label={t('lastName')} value={f.lastName} onChangeText={set('lastName')} />
      <Field label={t('email')} value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Field label={t('phone')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Text variant="label">{t('kind')}</Text>
      <Row style={{ marginVertical: space.sm }}>
        <Chip label={t('roleStaff')} active={role === 'STAFF'} onPress={() => setRole('STAFF')} />
        {isOwner ? <Chip label={t('roleAdmin')} active={role === 'ADMIN'} onPress={() => setRole('ADMIN')} /> : null}
      </Row>
      <ToggleRow label={t('isInstructor')} value={isInstructor} onChange={setInstructor} />
      <ToggleRow label={t('isTherapist')} value={isTherapist} onChange={setTherapist} />
      {role === 'ADMIN' ? <ToggleRow label={t('owner')} value={owner} onChange={setOwner} /> : null}
      <Gap h={space.md} />
      <Notice text={lang === 'sq' ? 'Do të marrë një email. Hyn në aplikacion me këtë adresë dhe një kod — pa fjalëkalim.' : 'They get an email, then sign in to the app with this address and a code — no password.'} />
    </Screen>
  );
}
