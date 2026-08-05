import { Button } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';

export default function SettingsButton() {
  const router = useRouter();

  return (
    <Button
      accessibilityLabel="Open account settings"
      onPress={() => router.push('/Profile')}
      variant="outline"
      size="sm"
      className="h-12 w-12 rounded-xl p-3"
    >
      <Settings size={20} />
    </Button>
  );
}

