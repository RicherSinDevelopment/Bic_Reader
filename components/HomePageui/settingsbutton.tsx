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
      className="h-12 w-12 rounded-xl border-black/10 bg-white p-3 active:translate-y-0.5 dark:border-white/10 dark:bg-[#1A1E18]"
      style={homepageDepth.control}
    >
      <Settings color={isDark ? "#F4F5F1" : "#20231E"} size={20} />
    </Button>
  );
}
