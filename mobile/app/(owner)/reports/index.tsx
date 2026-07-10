import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function OwnerReports() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Reports" />
      <ComingSoon note="Pending payments, defaulters, and monthly sales land in Phase 6." />
    </View>
  );
}
