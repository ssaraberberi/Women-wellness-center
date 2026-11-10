import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from 'react-native';
import { Button, Field, Notice, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { lek } from '@/lib/format';
import { errorText, useT } from '@/lib/i18n';
import { colors, radius, shadow, space } from '@/theme';

export type PayTarget = { orderId: string; total: number; title?: string };

/**
 * Recording a cash payment at the desk. The amount starts at the price and can
 * be changed to what she actually paid (a trial, a rounded sum): that becomes
 * the price of the order, so nothing stays owed.
 */
export function PayDialog({ target, onClose, onPaid }: { target: PayTarget | null; onClose: () => void; onPaid: () => void }) {
  const { t, lang } = useT();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A new order opens with its own price.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (target && shownFor !== target.orderId) {
    setShownFor(target.orderId);
    setAmount(String(target.total));
    setError(null);
  }
  const pay = useMutation({
    mutationFn: () => api('POST', `/admin/orders/${target!.orderId}/payments`, { body: { method: 'CASH', amount: Number(amount) } }),
    onSuccess: () => {
      setShownFor(null);
      onPaid();
      onClose();
    },
    onError: (e) => setError(errorText(e, lang)),
  });
  const value = Number(amount);
  return (
    <Modal transparent visible={!!target} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text variant="title">{t('recordPayment')}</Text>
            {target?.title ? <Text variant="small" style={{ marginBottom: space.sm }}>{target.title}</Text> : null}
            <Field label={t('amountPaid')} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" autoFocus />
            {target && amount && value !== target.total ? <Text variant="small" style={{ marginTop: -space.sm, marginBottom: space.sm }}>{t('priceWas', { price: lek(target.total) })}</Text> : null}
            {error ? <Notice tone="danger" icon="alert-circle" text={error} /> : null}
            <Button title={t('markPaidCash', { amount: lek(value || 0) })} onPress={() => pay.mutate()} loading={pay.isPending} disabled={!amount} />
            <Button variant="ghost" title={t('cancel')} onPress={onClose} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.xs, ...shadow },
});
