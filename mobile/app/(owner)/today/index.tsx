import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function OwnerToday() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Today's Deliveries" subtitle="Phase 2 wires this up to the real ledger" />
      <ComingSoon note="Customer delivery cards, Mark Delivered / Changes / Skip / Extra, and Complete Remaining land in Phase 2." />
    </View>
  );
}
