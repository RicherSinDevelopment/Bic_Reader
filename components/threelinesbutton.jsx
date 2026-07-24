import { Button } from '@/components/ui/button';
import { Icon, MenuIcon } from '@/components/ui/icon';
import { useRouter } from "expo-router";
export default function ThreeLinesButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-12 w-12 rounded-xl p-3"
      onPress={() => router.back()}
    >
      <Icon as={MenuIcon} size="md" />
    </Button>
  );
}