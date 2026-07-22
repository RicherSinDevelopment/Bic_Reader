import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function Index() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-25 px-6 py-8">
      <Pressable
        onPress={() => router.push("/homescreen")}
        className="mt-10 rounded-xl bg-purple-600 px-4 py-3"
      >
        <Text className="text-white">Go to homescreen</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/sign-in")}
        className="mt-4 rounded-xl bg-purple-600 px-4 py-3"
      >
        <Text className="text-white">Sign in</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(auth)/sing-up")}
        className="mt-4 rounded-xl bg-purple-600 px-4 py-3"
      >
        <Text className="text-white">Sign up</Text>
      </Pressable>
     
    </View>
  );
}