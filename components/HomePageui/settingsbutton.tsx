import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react-native';

export default function SettingsButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-12 w-12 rounded-xl p-3"
    >
      <Settings size={20} />
    </Button>
  );
}

