import { Text, View } from 'react-native'

import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton, UiIcon } from '@/ui'

export default function GenerateProofStep() {
  const { circuitLoadingDetails } = useDocumentScanContext()

  const isOverallReady =
    circuitLoadingDetails?.isLoaded === true && circuitLoadingDetails?.isLoadFailed !== true

  const profileCreationStatus = 'completed'

  const downloadCircuitStatus =
    circuitLoadingDetails?.isLoaded === true || circuitLoadingDetails?.downloadingProgress === '100'
      ? 'completed'
      : 'processing'

  const createProofStatus = circuitLoadingDetails?.isLoaded === true ? 'completed' : 'processing'

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
        <StepRow title='Profile creation' status={profileCreationStatus} />
        <StepRow title='Download Circuit' status={downloadCircuitStatus} />
        <StepRow title='Create Proof' status={createProofStatus} />
      </View>

      {isOverallReady && (
        <View className='mt-auto'>
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
