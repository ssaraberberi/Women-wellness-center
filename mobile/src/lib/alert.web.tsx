import { Modal, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { create } from 'zustand';
import { colors, fonts, radius, shadow, space } from '@/theme';

type Dialog = { title: string; message?: string; buttons: AlertButton[] };
const useDialogs = create<{ queue: Dialog[] }>(() => ({ queue: [] }));

/** Same call as React Native's Alert.alert; shown by <AlertHost /> one at a time. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    useDialogs.setState((s) => ({ queue: [...s.queue, { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] }] }));
  },
};

export function AlertHost() {
  const dialog = useDialogs((s) => s.queue[0]);
  if (!dialog) return null;
  const close = (b?: AlertButton) => {
    useDialogs.setState((s) => ({ queue: s.queue.slice(1) }));
    b?.onPress?.();
  };
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancel)}>
      <Pressable style={styles.backdrop} onPress={() => close(cancel)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={styles.buttons}>
            {dialog.buttons.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                accessibilityRole="button"
                onPress={() => close(b)}
                style={({ hovered, pressed }) => [styles.button, b.style === 'cancel' ? styles.cancel : b.style === 'destructive' ? styles.destructive : styles.primary, (hovered || pressed) && { opacity: 0.85 }]}
              >
                <Text style={[styles.buttonText, b.style === 'cancel' ? { color: colors.inkSoft } : { color: colors.white }]}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, ...shadow },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: space.sm },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginBottom: space.md },
  buttons: { gap: space.sm, marginTop: space.sm },
  button: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primary: { backgroundColor: colors.wine },
  destructive: { backgroundColor: colors.danger },
  cancel: { backgroundColor: colors.sand },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15 },
});
