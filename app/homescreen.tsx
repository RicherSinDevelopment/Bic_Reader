import {
  BottomSheet,
  BottomSheetBackdrop,
  BottomSheetContent,
  BottomSheetDragIndicator,
  BottomSheetItem,
  BottomSheetItemText,
  BottomSheetPortal,
  BottomSheetTrigger,
} from '@/components/ui/bottomsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { ChevronDownIcon } from '@/components/ui/icon';
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsContentWrapper,
  TabsList,
  TabsTrigger,
  TabsTriggerText
} from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';

const homescreen = () => {
  return (
    <View className="flex-1 bg-gray-300 px-6 py-8">
      <Text className="mb-4 text-lg text-gray-900">homescreen</Text>

      <Button variant="destructive" size="default">
        <ButtonText>Button</ButtonText>
      </Button>

      <View className="mt-4">
        <Select>
          <SelectTrigger variant="outline" size="md">
            <SelectInput placeholder="Select option" />
            <SelectIcon className="mr-3" as={ChevronDownIcon} />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              <SelectItem label="UX Research" value="ux" />
              <SelectItem label="Web Development" value="web" />
              <SelectItem label="Cross Platform Development Process" value="cross" />
              <SelectItem label="UI Designing" value="ui" isDisabled={true} />
              <SelectItem label="Backend Development" value="backend" />
            </SelectContent>
          </SelectPortal>
        </Select>
      </View>
       <BottomSheet>
      <BottomSheetTrigger>
        <Text>Open BottomSheet</Text>
      </BottomSheetTrigger>
      <BottomSheetPortal
        snapPoints={['25%', '50%']}
        backdropComponent={BottomSheetBackdrop}
        handleComponent={BottomSheetDragIndicator}
      >
        <BottomSheetContent>
          <BottomSheetItem>
            <BottomSheetItemText>Item 1</BottomSheetItemText>
          </BottomSheetItem>
          <BottomSheetItem>
            <BottomSheetItemText>Item 2</BottomSheetItemText>
          </BottomSheetItem>
          <BottomSheetItem>
            <BottomSheetItemText>Item 3</BottomSheetItemText>
          </BottomSheetItem>
        </BottomSheetContent>
      </BottomSheetPortal>
    </BottomSheet>
    <Tabs defaultValue="home">
      <TabsList>
        <TabsTrigger value="home">
          <TabsTriggerText>Reader</TabsTriggerText>
        </TabsTrigger>
        <TabsTrigger value="profile">
          <TabsTriggerText>Original</TabsTriggerText>
        </TabsTrigger>
      </TabsList>

      <TabsContentWrapper>
        <TabsContent value="home">
          <Box className="p-4">
            <Text className="text-foreground">Welcome to the Home tab!</Text>
          </Box>
        </TabsContent>
        <TabsContent value="profile">
          <Box className="p-4">
            <Text className="text-foreground">Your profile information</Text>
          </Box>
        </TabsContent>
      </TabsContentWrapper>
    </Tabs>

    </View>
  );
};

export default homescreen;