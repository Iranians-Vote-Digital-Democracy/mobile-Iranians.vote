import { useState } from 'react'
import { Pressable, Text } from 'react-native'
import { View } from 'react-native-reanimated/lib/typescript/Animated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { cn, useAppPaddings, useBottomBarOffset } from '@/theme/utils'
import { UiCard, UiIcon } from '@/ui'
import UiScreenScrollable from '@/ui/UiScreenScrollable'

export default function PollsScreen() {
  // {}: AppTabScreenProps<'Polls'>
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()
  const offset = useBottomBarOffset()
  return (
    <UiScreenScrollable
      style={{
        paddingTop: insets.top,
        paddingLeft: appPaddings.left,
        paddingRight: appPaddings.right,
        paddingBottom: offset,
      }}
      className='gap-3'
    >
      <View className='flex flex-row items-center gap-4'>
        <Text className='typography-h4 color-textPrimary'>Welcome</Text>
        <View className='flex-1' />
        <Pressable onPress={() => {}}>
          <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
            <UiIcon customIcon='qrCodeIcon' size={20} className='color-textPrimary' />
          </View>
        </Pressable>
      </View>
      <PollsContent />
    </UiScreenScrollable>
  )
}

function PollsContent() {
  const [activeTab, setActiveTab] = useState<'active' | 'finished'>('active')

  return (
    <View className='flex-1 p-4'>
      <View className='mb-4 flex-row justify-around'>
        <Pressable onPress={() => setActiveTab('active')}>
          <Text
            className={cn(
              'typography-subtitle4',
              activeTab === 'active' ? 'text-primaryMain' : 'text-textSecondary',
            )}
          >
            Active
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('finished')}>
          <Text
            className={cn(
              'typography-subtitle4',
              activeTab === 'finished' ? 'text-primaryMain' : 'text-textSecondary',
            )}
          >
            Finish
          </Text>
        </Pressable>
      </View>

      {activeTab === 'active' ? (
        <View className='flex-col gap-4'>
          <PollsCard
            title='testpolls'
            subtitle='Test'
            date='15 Jul'
            onPress={() => {
              // eslint-disable-next-line no-console
              console.log('Card pressed')
            }}
          />
        </View>
      ) : (
        <View className='flex-col gap-4'>
          <Text>Finish</Text>
        </View>
      )}
    </View>
  )
}

function PollsCard({
  title,
  subtitle,
  date,
  onPress,
}: {
  title: string
  subtitle: string
  date: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} className='overflow-hidden rounded-3xl'>
      <UiCard className='p-6'>
        <View className='flex-col gap-2'>
          <Text className='typography-subtitle4 text-textPrimary'>{title}</Text>
          <Text className='typography-body4 text-textSecondary'>{subtitle}</Text>
        </View>
        <View className='mt-6 flex-row items-center justify-between'>
          <View className='flex-row items-center gap-2'>
            <UiIcon customIcon='calendarBlankIcon' size={20} className='color-textSecondary' />
            <Text className='typography-subtitle5 text-textSecondary'>{date}</Text>
          </View>
          <UiIcon customIcon='arrowRightIcon' size={24} className='color-textSecondary' />
        </View>
      </UiCard>
    </Pressable>
  )
}
