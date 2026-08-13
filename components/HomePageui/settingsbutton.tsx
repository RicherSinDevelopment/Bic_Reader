import { Button } from "@/components/ui/button";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { homepageDepth } from "@/components/HomePageui/depthStyles";

export default function SettingsButton() {
  const router = useRouter();

  return (
    <Button
      accessibilityLabel="Open account settings"
      onPress={() => router.push("/Profile")}
      variant="outline"
      size="sm"
      className="h-12 w-12 rounded-xl border-black/10 bg-white p-3 active:translate-y-0.5"
      style={homepageDepth.control}
    >
      <Settings size={20} />
    </Button>
  );
}
