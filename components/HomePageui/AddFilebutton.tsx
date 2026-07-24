import { Button, ButtonText } from '@/components/ui/button';
import { AddIcon, Icon } from '@/components/ui/icon';

export default function AddButton() {
  return (
    <Button
      variant="default"
      size="lg"
      className="h-14 px-5 rounded-xl flex-row items-center justify-center bg-green-400"
    >
      <Icon as={AddIcon} size="md" className="mr-2" />
      <ButtonText className="font-lato-bold" style={{ fontFamily: 'Lato_700Bold' }}>
        ADD
      </ButtonText>
    </Button>
  );
}