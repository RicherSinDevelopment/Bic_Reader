import { Lato_400Regular, Lato_700Bold, useFonts } from "@expo-google-fonts/lato";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import './global.css';
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
      <Stack screenOptions={{ headerShown: false }} />;
    </GestureHandlerRootView>
  );
   
}
