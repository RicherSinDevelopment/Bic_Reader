import ReaderGlassIconButton from "@/components/readerui/ReaderGlassIconButton";
import { ArrowLeftIcon, Icon } from "@/components/ui/icon";
import { useRouter } from "expo-router";

export default function BackButton() {
  const router = useRouter();

  return (
    <ReaderGlassIconButton
      accessibilityLabel="Go back"
      onPress={() => router.back()}
    >
      <Icon as={ArrowLeftIcon} size="lg" className="text-[#242424]" />
    </ReaderGlassIconButton>
  );
}
