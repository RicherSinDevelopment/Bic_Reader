import AddButton from '@/components/HomePageui/AddFilebutton';
import SearchButton from '@/components/HomePageui/SearchButton';
import SettingsButton from '@/components/HomePageui/settingsbutton';
import PdfLibrary from '@/hooks/displaypdfs';
import React from 'react';
import { Text, View } from 'react-native';
const HomePage = () => {
  return (
    <View className='flex-1 '>
      <View className='flex-row px-10 py-10 justify-between'>
        <Text className=''>HomePage</Text>
        <View className='flex-row gap-4'>
          <SearchButton />
          <SettingsButton />
        </View>
      </View>
      <PdfLibrary />
      <AddButton/>
    </View>
  )
}

export default HomePage