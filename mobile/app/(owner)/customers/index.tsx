import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function OwnerCustomers() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Customers" subtitle="Phase 1 adds Add / Edit / recurring rules" />
      <ComingSoon note="Customer list, add customer, and recurring delivery editing land in Phase 1." />
    </View>
  );
}
