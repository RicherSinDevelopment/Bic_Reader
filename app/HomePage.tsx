import AddButton from '@/components/HomePageui/AddFilebutton';
import React from 'react';
import { Text, View } from 'react-native';
const HomePage = () => {
  return (
    <View className='flex-1 p-12'>
      <Text>HomePage</Text>
      <AddButton/>
    </View>
  )
}

export default HomePage