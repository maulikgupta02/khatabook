import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import { useShop } from '@/lib/supabase/useShop';
import { formatCurrency, todayIso } from '@/lib/format';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, fonts, spacing } from '@/constants/theme';
import type { Item } from '@/lib/supabase/types';

type ItemWithPrice = Item & { currentPrice: number | null };

export default function OwnerItems() {
  const { shopId, loading: shopLoading } = useShop();
  const [items, setItems] = useState<ItemWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    const { data: itemRows } = await supabase
      .from('items')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true });
    const ids = (itemRows ?? []).map((i) => i.id);
    let priceByItem: Record<string, number> = {};
    if (ids.length) {
      const { data: priceRows } = await supabase
        .from('item_price_history')
        .select('item_id, price')
        .in('item_id', ids)
        .is('effective_to', null);
      priceByItem = Object.fromEntries((priceRows ?? []).map((p) => [p.item_id, Number(p.price)]));
    }
    setItems((itemRows ?? []).map((i) => ({ ...i, currentPrice: priceByItem[i.id] ?? null })));
    setLoading(false);
    setRefreshing(false);
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive(item: ItemWithPrice) {
    await supabase.from('items').update({ is_active: !item.is_active }).eq('id', item.id);
    load();
  }

  if (shopLoading || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
        <ScreenHeader title="Items & Pricing" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Items & Pricing" subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Button label={showAdd ? 'Cancel' : '+ Add Item'} variant={showAdd ? 'neutral' : 'primary'} onPress={() => setShowAdd((v) => !v)} />

        {showAdd && shopId ? (
          <AddItemForm
            shopId={shopId}
            onDone={() => {
              setShowAdd(false);
              load();
            }}
          />
        ) : null}

        {items.length === 0 && !showAdd ? (
          <ComingSoon note="No items yet. Add your first item (e.g. Full Cream Milk) with its starting price." />
        ) : null}

        {items.map((item) =>
          editingId === item.id ? (
            <EditPriceForm
              key={item.id}
              item={item}
              onDone={() => {
                setEditingId(null);
                load();
              }}
            />
          ) : (
            <Pressable key={item.id} onPress={() => setEditingId(item.id)}>
              <Card style={[styles.itemCard, !item.is_active && { opacity: 0.55 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemUnit}>per {item.unit}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  {item.currentPrice !== null ? formatCurrency(item.currentPrice) : '—'}
                </Text>
                <Button
                  label={item.is_active ? 'Deactivate' : 'Activate'}
                  variant={item.is_active ? 'neutral' : 'success'}
                  onPress={() => handleToggleActive(item)}
                  style={styles.smallButton}
                />
              </Card>
            </Pressable>
          )
        )}
      </ScrollView>
    </View>
  );
}

function AddItemForm({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('litre');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const priceNum = Number(price);
    if (!name.trim() || !unit.trim() || !price || Number.isNaN(priceNum) || priceNum <= 0) {
      setError('Enter a name, unit, and a valid starting price.');
      return;
    }
    setSaving(true);
    try {
      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({ shop_id: shopId, name: name.trim(), unit: unit.trim() })
        .select()
        .single();
      if (itemError) throw itemError;
      const { error: priceError } = await supabase.rpc('set_item_price', {
        p_item_id: item.id,
        p_price: priceNum,
        p_effective_from: todayIso(),
      });
      if (priceError) throw priceError;
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <TextField label="Item name" value={name} onChangeText={setName} placeholder="Full Cream Milk" />
      <TextField label="Unit" value={unit} onChangeText={setUnit} placeholder="litre / packet / kg" />
      <TextField label="Starting price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="60" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save Item" onPress={handleSave} loading={saving} />
    </Card>
  );
}

function EditPriceForm({ item, onDone }: { item: ItemWithPrice; onDone: () => void }) {
  const [price, setPrice] = useState(item.currentPrice !== null ? String(item.currentPrice) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) {
      setError('Enter a valid price.');
      return;
    }
    setSaving(true);
    try {
      const { error: priceError } = await supabase.rpc('set_item_price', {
        p_item_id: item.id,
        p_price: priceNum,
        p_effective_from: todayIso(),
      });
      if (priceError) throw priceError;
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update price');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.itemName}>{item.name}</Text>
      <TextField label={`New price (effective today)`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="neutral" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Save Price" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemName: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.textPrimary },
  itemUnit: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.primary },
  smallButton: { minHeight: 34, paddingVertical: 6, paddingHorizontal: spacing.md },
  error: { color: colors.dangerText, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
