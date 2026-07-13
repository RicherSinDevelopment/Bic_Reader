import { Text, View } from "react-native";
 
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-green-400">
        Welcome to Nativewind!
      </Text>
       <Text className="text-l font-bold text-green-400">
        Welcome to Nativewind!
      </Text>
       <Text className="font-lato-sans text-xl text-green-400">
        Regular Lato (font-sans)
      </Text>
      <Text className="font-lato-bold text-xl text-green-400">
        Bold Lato (font-lato-bold)
      </Text>
    </View>
  );
}