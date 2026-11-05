import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, View } from 'react-native';
import { ErrorState, Header, Screen, SkeletonList, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, lek, whenShort } from '@/lib/format';
import { tEnum, useT } from '@/lib/i18n';
import { colors, space } from '@/theme';

interface Log {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName?: string | null;
  subjectName?: string | null;
  data: unknown;
  createdAt: string;
}
type Lang = 'sq' | 'en';
type Pair = [string, string];

// The audit log's own words. They only appear on this screen, so they live here.
const ACTIONS: Record<string, Pair> = {
  'booking.create_for_client': ['Rezervim për klienten', 'Booking for a client'],
  'booking.cancel': ['Rezervim i anuluar', 'Booking cancelled'],
  'credit.restore': ['Kredit i rikthyer', 'Credit restored'],
  'credit.adjust': ['Kreditet u ndryshuan', 'Credits adjusted'],
  'session.create': ['Klasë e re', 'Class added'],
  'session.update': ['Klasa u ndryshua', 'Class changed'],
  'session.cancel': ['Klasa u anulua', 'Class cancelled'],
  'template.create': ['Orar javor i ri', 'Weekly slot added'],
  'template.update': ['Orari javor u ndryshua', 'Weekly slot changed'],
  'template.deactivate': ['Orari javor u ndal', 'Weekly slot stopped'],
  'class_type.create': ['Lloj klase i ri', 'Class type added'],
  'class_type.update': ['Lloji i klasës u ndryshua', 'Class type changed'],
  'closure.add': ['Studio e mbyllur', 'Studio closed'],
  'closure.remove': ['Studio u rihap', 'Studio reopened'],
  'settings.update': ['Cilësimet u ndryshuan', 'Settings changed'],
  'product.create': ['Paketë e re', 'Package added'],
  'product.update': ['Paketa u ndryshua', 'Package changed'],
  'package.assign': ['Paketë për klienten', 'Package given to a client'],
  'purchase.extend': ['Paketa u zgjat', 'Package extended'],
  'promotion.create': ['Kod promocional i ri', 'Promo code added'],
  'promotion.update': ['Kodi promocional u ndryshua', 'Promo code changed'],
  'announcement.create': ['Njoftim i ri', 'Announcement posted'],
  'treatment.create': ['Trajtim SPA i ri', 'SPA treatment added'],
  'treatment.update': ['Trajtimi SPA u ndryshua', 'SPA treatment changed'],
  'spa_block.create': ['Kohë e bllokuar në SPA', 'SPA time blocked'],
  'spa.create': ['Takim SPA për klienten', 'SPA booking for a client'],
  'spa.cancel': ['Takimi SPA u anulua', 'SPA booking cancelled'],
  'spa.reschedule': ['Takimi SPA u zhvendos', 'SPA booking moved'],
  'payment.record': ['Pagesë e regjistruar', 'Payment recorded'],
  'payment.refund': ['Rimbursim', 'Refund'],
  'payment.online_complete': ['Pagesë online', 'Online payment'],
  'order.cancel': ['Porosia u anulua', 'Order cancelled'],
  'staff.invite': ['Punonjëse e ftuar', 'Staff invited'],
  'staff.update': ['Punonjësja u ndryshua', 'Staff changed'],
  'staff.qualifications': ['Kualifikimet u ndryshuan', 'Qualifications changed'],
  'staff.hours': ['Orari i punës u ndryshua', 'Working hours changed'],
  'staff_request.review': ['Kërkesë e shqyrtuar', 'Request reviewed'],
  'client.create': ['Kliente e re', 'Client added'],
  'client.update': ['Klientja u ndryshua', 'Client changed'],
  'client.delete': ['Të dhënat e klientes u fshinë', 'Client data deleted'],
  'client.notify': ['Mesazh për klienten', 'Message to a client'],
  'account.deletion_requested': ['Kërkesë për fshirje llogarie', 'Account deletion requested'],
};

const FIELDS: Record<string, Pair> = {
  amount: ['Shuma', 'Amount'],
  method: ['Mënyra', 'Method'],
  reason: ['Arsyeja', 'Reason'],
  refunded: ['Kredit i kthyer', 'Credit returned'],
  affected: ['Kliente të prekura', 'Clients affected'],
  removedSessions: ['Klasa të hequra', 'Classes removed'],
  cancelPurchase: ['Paketa u anulua', 'Package cancelled'],
  giveBack: ['Seanca u kthye', 'Session returned'],
  inTime: ['Në kohë', 'In time'],
  from: ['Nga', 'From'],
  to: ['Te', 'To'],
  date: ['Data', 'Date'],
  email: ['Email', 'Email'],
  role: ['Roli', 'Role'],
  isOwner: ['Pronare', 'Owner'],
  delta: ['Kredite', 'Credits'],
  days: ['Ditë', 'Days'],
  paid: ['E paguar', 'Paid'],
  discount: ['Zbritje', 'Discount'],
  name: ['Emri', 'Name'],
  nameEn: ['Emri (EN)', 'Name (EN)'],
  firstName: ['Emri', 'First name'],
  lastName: ['Mbiemri', 'Last name'],
  phone: ['Telefoni', 'Phone'],
  price: ['Çmimi', 'Price'],
  originalPrice: ['Çmimi i vjetër', 'Original price'],
  capacity: ['Vende', 'Places'],
  weekday: ['Dita', 'Day'],
  startTime: ['Ora', 'Time'],
  startsAt: ['Fillon', 'Starts'],
  endsAt: ['Mbaron', 'Ends'],
  durationMin: ['Kohëzgjatja (min)', 'Duration (min)'],
  validFrom: ['Nga data', 'From date'],
  validUntil: ['Deri më', 'Until'],
  active: ['Aktive', 'Active'],
  status: ['Statusi', 'Status'],
  title: ['Titulli', 'Title'],
  body: ['Teksti', 'Text'],
  code: ['Kodi', 'Code'],
  classCredits: ['Klasa', 'Classes'],
  validityDays: ['Vlefshmëria (ditë)', 'Valid for (days)'],
  compensationModel: ['Pagesa', 'Compensation'],
  compensationRate: ['Tarifa', 'Rate'],
  canViewClientNotes: ['Sheh shënimet', 'Sees notes'],
  isInstructor: ['Instruktore', 'Instructor'],
  isTherapist: ['Terapiste', 'Therapist'],
  bio: ['Bio', 'Bio'],
  room: ['Salla', 'Room'],
  cancelReason: ['Arsyeja e anulimit', 'Cancel reason'],
  reviewNote: ['Shënim', 'Note'],
  discountType: ['Lloji i zbritjes', 'Discount type'],
  discountValue: ['Zbritja', 'Discount'],
  maxRedemptions: ['Përdorime maks.', 'Max uses'],
};

const MONEY = new Set(['amount', 'price', 'originalPrice', 'discount', 'compensationRate']);
const WEEKDAYS: Record<Lang, string[]> = {
  sq: ['E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë', 'E diel'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

const pick = (p: Pair, lang: Lang) => p[lang === 'sq' ? 0 : 1];

/** "compensationRate" → "Compensation rate", for a field nobody named above. */
const humanize = (key: string) => {
  const s = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function actionLabel(action: string, lang: Lang) {
  const known = ACTIONS[action];
  return known ? pick(known, lang) : humanize(action.replace('.', ' '));
}

function valueText(key: string, v: unknown, lang: Lang): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return lang === 'sq' ? (v ? 'Po' : 'Jo') : v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    if (MONEY.has(key)) return lek(v);
    if (key === 'weekday' && v >= 1 && v <= 7) return WEEKDAYS[lang][v - 1];
    if (key === 'delta' && v > 0) return `+${v}`;
    return String(v);
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return whenShort(v, lang);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dateShort(`${v}T12:00:00Z`, lang);
    if (/^[A-Z][A-Z_]+$/.test(v)) return tEnum(lang, v);
    return v;
  }
  if (Array.isArray(v)) return v.length ? String(v.length) : null;
  return lang === 'sq' ? 'ndryshuar' : 'changed';
}

/** The data of one entry as "Label: value" lines; ids are left out, the names above stand for them. */
function details(data: unknown, lang: Lang): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (key === 'id' || /Ids?$/.test(key)) continue;
    const value = valueText(key, raw, lang);
    if (value === null) continue;
    lines.push(`${FIELDS[key] ? pick(FIELDS[key], lang) : humanize(key)}: ${value}`);
  }
  return lines;
}

/** Who changed what: payments, credits, staff, settings. */
export default function Audit() {
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => api<Log[]>('GET', '/admin/audit-logs?limit=200') });
  return (
    <Screen scroll={false}>
      <Header title={t('auditLog')} back />
      {q.isPending ? (
        <SkeletonList count={8} height={52} />
      ) : !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.wine} />}
          renderItem={({ item }) => {
            const lines = details(item.data, lang);
            const by = item.actorName ?? (item.actorId ? null : lang === 'sq' ? 'Sistemi' : 'System');
            return (
              <View style={{ paddingVertical: space.sm, borderBottomWidth: 0.5, borderBottomColor: colors.line, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="bodyMedium" style={{ flexShrink: 1 }}>{actionLabel(item.action, lang)}</Text>
                  <Text variant="caption">{whenShort(item.createdAt, lang)}</Text>
                </View>
                {item.subjectName ? <Text variant="body">{item.subjectName}</Text> : null}
                {lines.length ? (
                  <Text variant="small" numberOfLines={4}>{lines.join('\n')}</Text>
                ) : null}
                {by ? <Text variant="caption">{lang === 'sq' ? `nga ${by}` : `by ${by}`}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
