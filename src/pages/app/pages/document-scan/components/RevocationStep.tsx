import { useState } from 'react'
import { Text, View } from 'react-native'

import { UiButton, UiIcon } from '@/ui'

import { useDocumentScanContext } from '../ScanProvider'

export default function RevocationStep() {
  const { revokeIdentity } = useDocumentScanContext()
  const [isScanning] = useState(false)

  const [title] = useState('Scan NFC')

  return (
    <View className='flex flex-1 flex-col justify-center'>
      <Text className='typography-h5 text-center text-textPrimary'>Revocation</Text>
      <Text className='typography-h5 text-center text-textPrimary'>{title}</Text>
      {isScanning ? (
        <View className='flex items-center'>
          <UiIcon customIcon='bellFillIcon' className='size-[120] text-textPrimary' />
        </View>
      ) : (
        <UiButton onPress={revokeIdentity} title='Try Scan Again' />
      )}
    </View>
  )
}
