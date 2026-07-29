import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '@/components/ui/drawer';
import { Heading } from '@/components/ui/heading';
import { CloseIcon, Icon, MenuIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import React from 'react';

export default function ThreeLinesButton() {
  const [showDrawer, setShowDrawer] = React.useState(false);

  return (
    <>
      {/* Menu Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-12 w-12 rounded-xl p-3"
        onPress={() => setShowDrawer(true)}
      >
        <Icon as={MenuIcon} size="md" />
      </Button>

      {/* Drawer */}
      <Drawer
        isOpen={showDrawer}
        size="base"
        anchor="left"
        onClose={() => {
          setShowDrawer(false);
        }}
      >
        <DrawerBackdrop />

        <DrawerContent className="pt-safe">
          <DrawerHeader>
            <Heading
              size="lg"
              className="text-foreground font-semibold"
            >
              Menu
            </Heading>

            <DrawerCloseButton>
              <Icon
                as={CloseIcon}
                className="stroke-foreground"
                size="lg"
              />
            </DrawerCloseButton>
          </DrawerHeader>

          <DrawerBody>
            <Text>
              This is your menu drawer.
            </Text>
          </DrawerBody>

          <DrawerFooter>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

