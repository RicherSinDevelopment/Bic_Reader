import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { migrateDatabase } from "@/database/migrations";
import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
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
  });

  if (!fontsLoaded) {
    return null;
  }
  
 return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider>
          <SQLiteProvider databaseName="bic_reader.db" onInit={migrateDatabase}>
            <Stack screenOptions={{ headerShown: false }} />
          </SQLiteProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
   
}
