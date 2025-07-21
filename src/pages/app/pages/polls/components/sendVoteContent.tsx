import { useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { UiButton, UiHorizontalDivider, UiIcon } from '@/ui'

enum Step {
  SendProof,
  Finish,
}

export default function SendVoteScreen() {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>(Step.SendProof)
  const [progress, setProgreess] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const generateProof = () => {
    //TODO : Implement claim calldata proof
    //TODO generation logic contract call
    setProgreess(100)
    setStep(Step.Finish)
  }

  const renderContent = () => {
    switch (step) {
      case Step.SendProof:
        return (
          <View className='w-full items-center gap-6'>
            <View className='mb-4 flex-row items-center justify-center rounded-full bg-warningLight'>
              <UiIcon
                customIcon='dotsThreeOutlineIcon'
                size={64}
                className='mb-4 color-warningMain'
              />
            </View>

            <Text className='typography-h5 mb-2 text-textPrimary'>Please wait</Text>
            <Text className='typography-body3 mb-6 text-textSecondary'>Anonymizing your vote</Text>
            <View className='mb-4 h-2 w-4/5 rounded-full bg-componentPrimary'>
              <View
                className='h-full rounded-full bg-primaryMain'
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className='typography-caption2 mb-8 text-primaryMain'>
              {progress.toFixed(0)}%
            </Text>
            <UiHorizontalDivider />
            <View className='w-full flex-row items-center rounded-lg bg-warningLight p-3'>
              <UiIcon customIcon='infoIcon' size={18} className='mr-2 color-warningMain' />
              <Text className='typography-body4 flex-1 text-warningMain'>
                Please don't close the app, or your answers won't be included.
              </Text>
            </View>
          </View>
        )

      case Step.Finish:
        return (
          <View className='w-full items-center gap-6'>
            <View className='mb-4 flex-row items-center justify-center rounded-full bg-successLight'>
              <UiIcon customIcon='checkIcon' size={64} className='mb-4 color-successMain' />
            </View>

            <Text className='typography-h5 mb-2 text-textPrimary'>Poll finished</Text>
            <Text className='typography-body3 mb-6 text-textSecondary'>
              Thanks for participation!
            </Text>
            <UiHorizontalDivider />
            <View className='absolute bottom-0 mb-4 w-full px-4'>
              <UiButton title='Go Back' onPress={() => {}} className='w-full' />
            </View>
          </View>
        )
    }
  }

  return (
    <View
      className='h-full justify-center gap-3 bg-backgroundPrimary p-4'
      style={{
        paddingBottom: insets.bottom,
        paddingTop: insets.top,
      }}
    >
      {renderContent()}
    </View>
  )
}
