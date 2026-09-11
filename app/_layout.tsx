import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { AppErrorBoundary } from '@/components/errors/AppErrorBoundary';
import { migrateDatabase } from "@/database/migrations";
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { RevenueCatProvider } from '@/providers/RevenueCatProvider';
import { CloudSyncProvider } from '@/providers/CloudSyncProvider';
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3/400Regular";
import { Stack } from "expo-router";
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
import { initializeErrorReporting, Sentry } from "@/services/errorReporting";
import './global.css';

initializeErrorReporting();

// Gorhom Bottom Sheet still performs a few compatibility reads that trigger
// Reanimated's strict diagnostic even though its animations run as worklets.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function RootLayout() {
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
    <AppErrorBoundary
      area="application-root"
      fallbackTitle="Bic Reader couldn't start"
      fallbackMessage="Something unexpected happened. Try starting the app again."
    >
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
                    <CloudSyncProvider>
                      <RootNavigator />
                    </CloudSyncProvider>
                  </SQLiteProvider>
                </Suspense>
              </RevenueCatProvider>
            </AuthProvider>
          </GluestackUIProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
   
}

export default Sentry.wrap(RootLayout);

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

  if (isLoading) {
    return <StartupLoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ orientation: "portrait" }} />
      <Stack.Screen name="auth" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen
        name="HomePage"
        options={{ orientation: "portrait" }}
      />
      <Stack.Screen name="OpenPdf" />
      <Stack.Screen name="Profile" />
      <Stack.Screen name="Reader" />
    </Stack>
  );
}
