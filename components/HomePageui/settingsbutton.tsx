import { Button } from "@/components/ui/button";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { homepageDepth } from "@/components/HomePageui/depthStyles";
import { useColorScheme } from "react-native";

export default function SettingsButton() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  return (
    <Button
      accessibilityLabel="Open settings"
      onPress={() => router.push("/Profile")}
      variant="outline"
      size="sm"
      className="h-11 w-11 rounded-full border-[#E1E4D9] bg-[#FFFDF8] p-2.5 active:translate-y-0.5 dark:border-white/10 dark:bg-[#1A1E18]"
      style={homepageDepth.control}
    >
      <Settings color={isDark ? "#F4F5F1" : "#20231E"} size={20} />
    </Button>
  );
}
