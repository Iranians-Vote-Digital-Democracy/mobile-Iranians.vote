import { Text, View } from 'react-native'
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { UiButton, UiHorizontalDivider, UiIcon } from '@/ui'

export enum Step {
  SendProof,
  Finish,
}

interface SubmitVoteScreenProps {
  animatedValue: SharedValue<number>
  step: Step
  onGoBack: () => void
}

export default function SubmitVoteScreen({ animatedValue, step, onGoBack }: SubmitVoteScreenProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      className='h-full justify-center gap-3 bg-backgroundPrimary p-4'
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {step === Step.SendProof ? (
        <SendProofStep animatedValue={animatedValue} />
      ) : (
        <FinishStep onGoBack={onGoBack} />
      )}
    </View>
  )
}

function SendProofStep({ animatedValue }: { animatedValue: SharedValue<number> }) {
  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedValue.value}%`,
  }))

  return (
    <View className='w-full items-center gap-6'>
      <View className='mb-4 flex-row items-center justify-center rounded-full bg-warningLight'>
        <UiIcon customIcon='dotsThreeOutlineIcon' size={64} className='color-warningMain' />
      </View>

      <Text className='typography-h5 mb-2 text-textPrimary'>Please wait</Text>
      <Text className='typography-body3 mb-6 text-textSecondary'>Anonymizing your vote</Text>

      <View className='mb-4 h-2 w-4/5 rounded-full bg-componentPrimary'>
        <Animated.View className='h-full rounded-full bg-primaryMain' style={barStyle} />
      </View>

      <UiHorizontalDivider />

      <View className='w-full flex-row items-center rounded-lg bg-warningLight p-3'>
        <UiIcon customIcon='infoIcon' size={18} className='mr-2 color-warningMain' />
        <Text className='typography-body4 flex-1 text-warningMain'>
          Please don't close the app, or your answers won't be included.
        </Text>
      </View>
    </View>
  )
}

function FinishStep({ onGoBack }: { onGoBack: () => void }) {
  return (
    <View className='w-full flex-1 items-center'>
      <View className='w-full flex-1 items-center justify-center gap-6 px-4'>
        <View className='mb-4 flex-row items-center justify-center rounded-full bg-successLight'>
          <UiIcon customIcon='checkIcon' size={64} className='color-successMain' />
        </View>
        <Text className='typography-h5 mb-2 text-textPrimary'>Poll finished</Text>
        <Text className='typography-body3 mb-6 text-textSecondary'>Thanks for participation!</Text>
        <UiHorizontalDivider />
      </View>
      <View className='absolute inset-x-0 bottom-0 p-4'>
        <UiButton title='Go Back' onPress={onGoBack} className='w-full' />
      </View>
    </View>
  )
}
