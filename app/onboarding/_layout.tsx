import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, orientation: 'portrait' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="comfortable" />
      <Stack.Screen name="customize" />
      <Stack.Screen name="features" />
      <Stack.Screen name="premium" />
    </Stack>
  );
}
