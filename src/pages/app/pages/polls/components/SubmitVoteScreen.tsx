import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { UiButton, UiHorizontalDivider, UiIcon } from '@/ui'

export enum Step {
  SendProof,
  Finish,
}

export type ScreenKey = 'questions' | 'submit'

interface SubmitVoteScreenProps {
  progress: number
  step: Step
  onGoBack: () => void
}
export default function SubmitVoteScreen({ progress, step, onGoBack }: SubmitVoteScreenProps) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className='h-full justify-center gap-3 bg-backgroundPrimary p-4'
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
    >
      {step === Step.SendProof ? (
        <SendProofStep progress={progress} />
      ) : (
        <FinishStep onGoBack={onGoBack} />
      )}
    </View>
  )
}

function SendProofStep({ progress }: { progress: number }) {
  return (
    <View className='w-full items-center gap-6'>
      <View className='mb-4 flex-row items-center justify-center rounded-full bg-warningLight'>
        <UiIcon customIcon='dotsThreeOutlineIcon' size={64} className='color-warningMain' />
      </View>
      <Text className='typography-h5 text-textPrimary'>Please wait</Text>
      <Text className='typography-body3 text-textSecondary'>Anonymizing your vote</Text>
      <View className='h-2 w-4/5 rounded-full bg-componentPrimary'>
        <View className='h-full rounded-full bg-primaryMain' style={{ width: `${progress}%` }} />
      </View>
      <Text className='typography-caption2 text-primaryMain'>{progress.toFixed(0)}%</Text>
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
    <View className='w-full items-center gap-6'>
      <View className='mb-4 flex-row items-center justify-center rounded-full bg-successLight'>
        <UiIcon customIcon='checkIcon' size={64} className='color-successMain' />
      </View>
      <Text className='typography-h5 text-textPrimary'>Poll finished</Text>
      <Text className='typography-body3 text-textSecondary'>Thanks for participation!</Text>
      <UiHorizontalDivider />
      <UiButton title='Go Back' onPress={onGoBack} className='w-full' />
    </View>
  )
}
