import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function OwnerItems() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Items & Pricing" subtitle="Phase 1 adds Add / Edit / price history" />
      <ComingSoon note="Item catalog with effective-dated pricing lands in Phase 1." />
    </View>
  );
}
