import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { migrateDatabase } from "@/database/migrations";
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3/400Regular";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import './global.css';

// Gorhom Bottom Sheet still performs a few compatibility reads that trigger
// Reanimated's strict diagnostic even though its animations run as worklets.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    SourceSans3_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }
  
 return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider>
          <AuthProvider>
            <SQLiteProvider databaseName="bic_reader.db" onInit={migrateDatabase}>
              <RootNavigator />
            </SQLiteProvider>
          </AuthProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
   
}

function RootNavigator() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return null;
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
