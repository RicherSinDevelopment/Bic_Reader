import BottomSheet, {
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { ReactNode, RefObject } from "react";

type Props = {
  bottomSheetRef: RefObject<BottomSheet>;
  children: ReactNode;
};

export default function AppBottomSheet({
  bottomSheetRef,
  children,
}: Props) {
  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={["40%"]}
      enablePanDownToClose
    >
      <BottomSheetView>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
}