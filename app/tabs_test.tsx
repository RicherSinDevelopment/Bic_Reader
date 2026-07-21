import ReaderSwitch from "@/components/ReaderSwitch";
import { View } from "react-native";

export default function ReaderScreen() {
  return (
    <View className="flex-1 bg-slate-600">
    <View className="flex-1 items-center pt-10">
      <ReaderSwitch />
    </View>
    </View>
  );
}