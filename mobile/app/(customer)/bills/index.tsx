import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function CustomerBills() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="My Bill" />
      <ComingSoon note="Monthly bill summary and day-wise history land in Phase 3." />
    </View>
  );
}
