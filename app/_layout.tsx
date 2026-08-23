import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { migrateDatabase } from "@/database/migrations";
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { RevenueCatProvider } from '@/providers/RevenueCatProvider';
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3/400Regular";
import { Redirect, Stack, useSegments } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { Suspense } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppearanceStore } from "@/stores/appearanceStore";
import './global.css';

// Gorhom Bottom Sheet still performs a few compatibility reads that trigger
// Reanimated's strict diagnostic even though its animations run as worklets.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  const appearancePreference = useAppearanceStore((state) => state.preference);
  // Start loading fonts without blocking the auth provider and router. Waiting
  // here previously delayed session restoration and left the app empty during
  // every development reload.
  useFonts({
    Lato_400Regular,
    Lato_700Bold,
    SourceSans3_400Regular,
  });
  
 return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode={appearancePreference}>
          <StatusBar style="auto" />
          <AuthProvider>
            <RevenueCatProvider>
              <Suspense fallback={<StartupLoadingScreen />}>
                <SQLiteProvider
                  databaseName="bic_reader.db"
                  onInit={migrateDatabase}
                  useSuspense
                >
                  <RootNavigator />
                </SQLiteProvider>
              </Suspense>
            </RevenueCatProvider>
          </AuthProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
   
}

function StartupLoadingScreen() {
  const isDark = useColorScheme() === "dark";
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? "#10120F" : "#F7F5EF",
      }}
    >
      <ActivityIndicator color="#4F7D1A" size="large" />
    </View>
  );
}

function RootNavigator() {
  const { isLoading, session } = useAuth();
  const segments = useSegments();

  if (isLoading) {
    return <StartupLoadingScreen />;
  }

  // A development reload can restore the last deep-link route even after the
  // password recovery is finished. Resolve that stale route here, before the
  // reset screen mounts, so authenticated users return directly to the app.
  if (session && segments[0] === "auth" && segments[1] === "reset-password") {
    return <Redirect href="/HomePage" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen
          name="HomePage"
          options={{ orientation: "portrait" }}
        />
        <Stack.Screen name="Profile" />
        <Stack.Screen name="Reader" />
      </Stack.Protected>
    </Stack>
  );
}
