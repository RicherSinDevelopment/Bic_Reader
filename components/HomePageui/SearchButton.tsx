
import { Button } from '@/components/ui/button';
import { Icon, SearchIcon } from '@/components/ui/icon';
import { useRouter } from 'expo-router';

export default function SearchButton() {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-12 w-12 rounded-xl p-3"
      onPress={() => router.back()}
    >
      <Icon as={SearchIcon} size="md" />
    </Button>
  );
}

