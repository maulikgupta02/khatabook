import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';

export default function CustomerBillMonth() {
  const { month } = useLocalSearchParams<{ month: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPage }}>
      <ScreenHeader title={`Bill — ${month}`} />
      <ComingSoon note="Day-wise detail for this month lands in Phase 3." />
    </View>
  );
}
