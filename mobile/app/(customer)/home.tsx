import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function CustomerHome() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title="Today's Delivery" />
      <ComingSoon note="Today's delivery status and running balance land in Phase 3." />
    </View>
  );
}
