import { useState } from 'react'
import { Text, View } from 'react-native'

import { UiButton, UiIcon } from '@/ui'

export enum Steps {
  CreateProfile,
  DownloadCircuit,
  GenerateProof,
  Final,
}

const StepRow = ({ title, status }: { title: string; status: 'completed' | 'processing' }) => (
  <View className='flex-row items-center justify-between border-b border-componentHovered py-2'>
    <Text className='typography-body2 text-textPrimary'>{title}</Text>
    {status === 'completed' ? (
      <View className='h-9 w-9 items-center justify-center rounded-full bg-successLight'>
        <UiIcon customIcon='checkIcon' size={20} className='color-successMain' />
      </View>
    ) : (
      <Text className='typography-body2 text-textSecondary'>Processing...</Text>
    )}
  </View>
)

export default function GenerateProofStep() {
  const [currentStep] = useState<Steps>(Steps.CreateProfile)

  const stepScreens = {
    [Steps.CreateProfile]: (
      <>
        <View className='mb-8 items-center'>
          <View className='h-16 w-16 items-center justify-center rounded-full bg-warningLight'>
            <UiIcon customIcon='dotsThreeOutlineIcon' size={40} className='color-warningMain' />
          </View>
          <Text className='typography-h5 mb-2 text-center text-textPrimary'>Please wait</Text>
          <Text className='typography-body3 text-center text-textSecondary'>
            Creating your digital profile
          </Text>
        </View>
        <View className='mb-8 w-full px-4'>
          <StepRow title='Profile creation' status='completed' />
          <StepRow title='Download Circuit' status='processing' />
          <StepRow title='Create Proof' status='processing' />
        </View>
      </>
    ),

    [Steps.DownloadCircuit]: (
      <>
        <View className='mb-8 items-center'>
          <View className='h-16 w-16 items-center justify-center rounded-full bg-warningLight'>
            <UiIcon customIcon='dotsThreeOutlineIcon' size={40} className='color-warningMain' />
          </View>
          <Text className='typography-h5 mb-2 text-center text-textPrimary'>Please wait</Text>
          <Text className='typography-body3 text-center text-textSecondary'>
            Creating your digital profile
          </Text>
        </View>
        <View className='mb-8 w-full px-4'>
          <StepRow title='Profile creation' status='completed' />
          <StepRow title='Download Circuit' status='processing' />
          <StepRow title='Create Proof' status='processing' />
        </View>
      </>
    ),

    [Steps.GenerateProof]: (
      <>
        <View className='mb-8 items-center'>
          <View className='h-16 w-16 items-center justify-center rounded-full bg-warningLight'>
            <UiIcon customIcon='dotsThreeOutlineIcon' size={40} className='color-warningMain' />
          </View>
          <Text className='typography-h5 mb-2 text-center text-textPrimary'>Please wait</Text>
          <Text className='typography-body3 text-center text-textSecondary'>
            Creating your digital profile
          </Text>
        </View>
        <View className='mb-8 w-full px-4'>
          <StepRow title='Profile creation' status='completed' />
          <StepRow title='Download Circuit' status='completed' />
          <StepRow title='Create Proof' status='processing' />
        </View>
      </>
    ),

    [Steps.Final]: (
      <>
        <View className='mb-8 items-center'>
          <View className='h-16 w-16 items-center justify-center rounded-full bg-successLight'>
            <UiIcon customIcon='checkIcon' size={40} className='color-successMain' />
          </View>
          <Text className='typography-h5 mb-2 text-center text-textPrimary'>Ready</Text>
          <Text className='typography-body3 text-center text-textSecondary'>
            A digital profile created
          </Text>
        </View>
        <View className='mb-8 w-full px-4'>
          <StepRow title='Profile creation' status='completed' />
          <StepRow title='Download Circuit' status='completed' />
          <StepRow title='Create Proof' status='completed' />
        </View>
        <View className='mt-auto w-full'>
          <UiButton
            title='Home Page'
            onPress={() => {}} // TODO:logic in future
            className='w-full'
          />
        </View>
      </>
    ),
  }

  const CurrentScreenContent = stepScreens[currentStep] || stepScreens[Steps.CreateProfile]

  return <View className='mb-20 mt-10 flex-1 justify-center p-6'>{CurrentScreenContent}</View>
}
