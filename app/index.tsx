import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-gray-25">
     <Link href="/homescreen" className="mt-10 rounded bg-purple-600 text-white p-4"> Go to homescreen </Link> 
     <Link href="/(auth)/sign-in" className="mt-10 rounded bg-purple-600 text-white p-4"> signin </Link> 
     <Link href="/(auth)/sing-up" className="mt-10 rounded bg-purple-600 text-white p-4"> singup </Link> 

    </SafeAreaView>
  );
}