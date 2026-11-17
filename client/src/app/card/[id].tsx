import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { CreditCard, ExternalLink, Plus, Trash2 } from 'lucide-react-native';
import { Fragment } from 'react';
import { View } from 'react-native';

import { CATALOG_AS_OF, isCash, product, type Rule } from '@/data/catalog';
import { CATEGORIES, type CategoryId } from '@/data/categories';
import { useStore } from '@/data/store';
import { confirm } from '@/lib/confirm';
import { money, rate, shortDate } from '@/lib/format';
import { useWide } from '@/theme/theme';
import { space } from '@/theme/tokens';
import { Badge, CategoryIcon, Divider, EmptyState, Row } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { CardArt } from '@/ui/CardArt';
import { Switch } from '@/ui/controls';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

const PERIOD = { month: 'month', quarter: 'quarter', year: 'year' } as Record<string, string>;

function ruleLabel(r: Rule, issuer: string): { title: string; category: CategoryId } {
  if (r.category.startsWith('portal:')) return { title: `${issuer === 'American Express' ? 'Amex' : issuer} Travel bookings`, category: 'travel' };
  if (r.category.startsWith('merchant:')) {
    const name = r.category.slice(9).split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    return { title: name, category: 'general' };
  }
  const c = CATEGORIES[r.category as CategoryId];
  return c ? { title: c.label, category: r.category as CategoryId } : { title: r.category, category: 'general' };
}

export default function CardBenefits() {
  const { id, card: cardId } = useLocalSearchParams<{ id: string; card?: string }>();
  const p = product(id);
  const wide = useWide();
  const toast = useToast();
  const walletCard = useStore((s) => s.cards.find((c) => (cardId ? c.id === cardId : c.productId === id)));
  const setEnabled = useStore((s) => s.setCardEnabled);
  const removeCard = useStore((s) => s.removeCard);

  if (!p) {
    return (
      <Screen back inShell={false}>
        <EmptyState icon={CreditCard} title="We don’t have details for this card yet" />
      </Screen>
    );
  }
  const cash = isCash(p);
  const rules = [...p.rules].sort((a, b) => b.rate - a.rate);

  async function remove() {
    if (!walletCard) return;
    if (!(await confirm('Remove this card?', 'CardMaxx will stop using it at checkout.', 'Remove'))) return;
    removeCard(walletCard.id);
    toast('Card removed');
    router.back();
  }

  const extras: string[] = [];
  if (p.rotating) extras.push(`${rate(p.rotating.rate, cash)} on categories that change every ${PERIOD[p.rotating.capPeriod]}, up to ${money(p.rotating.capCents, { whole: true })}${p.rotating.requiresActivation ? ' (activate each time)' : ''}.`);
  if (p.choiceCategory) extras.push(`${rate(p.choiceCategory.rate, cash)} in a category you choose: ${p.choiceCategory.options.map((o) => CATEGORIES[o as CategoryId]?.label.toLowerCase() ?? o).join(', ')}.`);
  if (p.topCategory) extras.push(`${rate(p.topCategory.rate, cash)} on whichever eligible category you spend the most in each ${PERIOD[p.topCategory.capPeriod ?? 'month']}${p.topCategory.capCents ? `, up to ${money(p.topCategory.capCents, { whole: true })}` : ''}.`);

  return (
    <Screen back inShell={false} maxWidth={wide ? 760 : undefined}>
      <View style={{ alignItems: wide ? 'flex-start' : 'center', flexDirection: wide ? 'row' : 'column', gap: space.xl }}>
        <CardArt product={p} mask={walletCard?.mask ?? '••••'} nickname={walletCard?.nickname} width={wide ? 300 : 280} />
        <View style={{ gap: space.sm, flex: wide ? 1 : undefined, alignItems: wide ? 'flex-start' : 'center' }}>
          <Text variant="h1" style={{ textAlign: wide ? 'left' : 'center' }}>{p.name}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : 'center' }}>
            <Badge label={p.annualFeeCents ? `${money(p.annualFeeCents, { whole: true })}/yr` : 'No annual fee'} tone={p.annualFeeCents ? 'neutral' : 'success'} />
            <Badge label={cash ? 'Cash back' : `${p.currency}`} tone="primary" />
          </View>
          {!cash && <Text variant="small" tone="muted">Points valued at {p.pointValueCents}¢ each</Text>}
          {walletCard ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm }}>
              <Text variant="bodyStrong">Use for CardMaxx</Text>
              <Switch value={walletCard.enabled} onChange={(v) => setEnabled(walletCard.id, v)} label="Use this card for CardMaxx purchases" />
            </View>
          ) : (
            <Button label="Add to wallet" icon={Plus} style={{ marginTop: space.sm }} onPress={() => router.push({ pathname: '/add-card', params: { product: p.id } })} />
          )}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <Text variant="h2" accessibilityRole="header">Earns</Text>
        <Surface padded={false} style={{ padding: space.sm }}>
          {rules.map((r, i) => {
            const l = ruleLabel(r, p.issuer);
            const cap = r.capCents ? `Up to ${money(r.capCents, { whole: true })} a ${PERIOD[r.capPeriod ?? 'year']}` : '';
            return (
              <Fragment key={r.category + i}>
                {i > 0 && <Divider inset={64} />}
                <Row left={<CategoryIcon category={l.category} />} title={l.title} subtitle={[r.note, cap].filter(Boolean).join(' · ') || undefined} right={<Badge label={rate(r.rate, cash)} tone="success" />} />
              </Fragment>
            );
          })}
          {rules.length > 0 && <Divider inset={64} />}
          <Row left={<CategoryIcon category="general" />} title="Everything else" right={<Badge label={rate(p.baseRate, cash)} tone="neutral" />} />
        </Surface>
        {extras.map((e) => (
          <Text key={e} variant="small" tone="muted">{e}</Text>
        ))}
      </View>

      <View style={{ gap: space.md }}>
        <Button label="See full terms on issuer site" icon={ExternalLink} variant="outline" onPress={() => WebBrowser.openBrowserAsync(p.sourceUrl)} />
        <Text variant="small" tone="subtle">Rates checked {shortDate(CATALOG_AS_OF + 'T12:00:00')}. Issuers change offers often.</Text>
        {walletCard && !walletCard.accountId && <Button label="Remove from wallet" icon={Trash2} variant="danger" onPress={remove} />}
      </View>
    </Screen>
  );
}
