import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

export default function Index() {
  const { isLoading, session } = useAuth();
  const isDark = useColorScheme() === 'dark';

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          isDark && styles.loadingContainerDark,
        ]}
      >
        <ActivityIndicator color="#4F7D1A" size="large" />
      </View>
    );
  }

  return <Redirect href={session ? '/HomePage' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F5EF',
  },
  loadingContainerDark: { backgroundColor: '#10120F' },
});
