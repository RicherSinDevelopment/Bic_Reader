import AppBottomSheet from "@/components/AddBottomSheet";
import { useBottomSheet } from "@/hooks/useBottomSheet";
import { Link } from 'expo-router';
import React from 'react';
import { Button, Text, View } from 'react-native';
const singup = () => {
  const sheet = useBottomSheet();
  return (
    <View className="flex-1 p-6">
    <View>
      <Text>singup</Text>
      <Link href="/(auth)/sing-up">Sing in</Link>
    </View>
     <View className="absolute bottom-8 left-6 right-6">
    <Button
      title="Open Sheet"
      onPress={sheet.open}
    />
  </View>


  {/* Bottom sheet should be outside the button container */}
  <AppBottomSheet
    bottomSheetRef={sheet.bottomSheetRef as React.RefObject<any>}
  >
    <Text>
      Add PDF Options
    </Text>

    <Button
      title="Close"
      onPress={sheet.close}
    />
  </AppBottomSheet>

    </View>
  )
}

export default singup