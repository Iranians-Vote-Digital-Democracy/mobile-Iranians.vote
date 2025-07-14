import { Text, View } from 'react-native'

import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton, UiIcon } from '@/ui'

export enum Steps {
  CreateProfile,
  DownloadCircuit,
  GenerateProof,
  Final,
}

interface StepData {
  id: Steps
  title: string
}

export default function GenerateProofStep() {
  const { circuitLoadingDetails } = useDocumentScanContext()

  const isOverallReady =
    circuitLoadingDetails?.isLoaded === true && circuitLoadingDetails?.isLoadFailed !== true

  const getProfileCreationStatus = (): 'completed' | 'processing' => {
    return 'completed'
  }

  const getDownloadCircuitStatus = (): 'completed' | 'processing' => {
    return circuitLoadingDetails?.isLoaded === true ||
      circuitLoadingDetails?.downloadingProgress === '100'
      ? 'completed'
      : 'processing'
  }

  const getCreateProofStatus = (): 'completed' | 'processing' => {
    return circuitLoadingDetails?.isLoaded === true ? 'completed' : 'processing'
  }

  const steps: StepData[] = [
    { id: Steps.CreateProfile, title: 'Profile creation' },
    { id: Steps.DownloadCircuit, title: 'Download Circuit' },
    { id: Steps.GenerateProof, title: 'Create Proof' },
  ]

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

  return (
    <View className='mb-20 mt-10 flex-1 justify-center p-6'>
      <View className='mb-8 items-center'>
        {isOverallReady ? (
          <View className='h-16 w-16 items-center justify-center rounded-full bg-successLight'>
            <UiIcon customIcon='checkIcon' size={40} className='color-successMain' />
          </View>
        ) : (
          <View className='h-16 w-16 items-center justify-center rounded-full bg-warningLight'>
            <UiIcon customIcon='dotsThreeOutlineIcon' size={40} className='color-warningMain' />
          </View>
        )}
        <Text className='typography-h5 mb-2 text-center text-textPrimary'>
          {isOverallReady ? 'Ready' : 'Please wait'}
        </Text>
        <Text className='typography-body3 text-center text-textSecondary'>
          {isOverallReady ? 'A digital profile created' : 'Creating your digital profile'}
        </Text>
      </View>

      <View className='mb-8 w-full px-4'>
        {steps.map((step, index) => {
          let currentStepStatus: 'completed' | 'processing'
          switch (step.id) {
            case Steps.CreateProfile:
              currentStepStatus = getProfileCreationStatus()
              break
            case Steps.DownloadCircuit:
              currentStepStatus = getDownloadCircuitStatus()
              break
            case Steps.GenerateProof:
              currentStepStatus = getCreateProofStatus()
              break
            default:
              currentStepStatus = 'processing'
          }

          if (index === 0) {
            return <StepRow key={step.id} title={step.title} status={currentStepStatus} />
          }
          return null
        })}
      </View>

      {isOverallReady && (
        <View className='mt-auto w-full'>
          <UiButton
            title='Home Page'
            onPress={() => {}} // TODO:logic in future
            className='w-full'
          />
        </View>
      )}
    </View>
  )
}
