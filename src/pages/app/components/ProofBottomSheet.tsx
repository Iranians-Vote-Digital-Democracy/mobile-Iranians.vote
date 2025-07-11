import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { QueryParams } from 'expo-linking'
import * as Linking from 'expo-linking'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppTheme } from '@/theme'
import { UiBottomSheet, UiButton, UiHorizontalDivider, useUiBottomSheet } from '@/ui'
import { BottomSheetHeader } from '@/ui/UiBottomSheet'
import { QueryIdentityCircuit } from '@/utils/circuits/query-identity-circuits'

export default function ProofBottomSheet() {
  const [modalParams, setModalParams] = useState<QueryParams | null>(null)
  const cardUiSettingsBottomSheet = useUiBottomSheet()

  const { palette } = useAppTheme()
  const insets = useSafeAreaInsets()

  const generateProof = async () => {
    const circuitParams = new QueryIdentityCircuit()
    const proof = await circuitParams.prove(JSON.stringify(QueryIdentityCircuit.TEST_DATA))
    console.log('success', proof)
  }

  useEffect(() => {
    const handleDeepLink = async () => {
      const url = await Linking.getInitialURL()
      if (!url) return

      const parsed = Linking.parse(url)
      const params = parsed.queryParams

      if (params && Object.keys(params).length > 0) {
        setModalParams(params)
        cardUiSettingsBottomSheet.present()
      }
    }

    handleDeepLink()
  }, [])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url)
      const params = parsed.queryParams

      if (params && Object.keys(params).length > 0) {
        setModalParams(params)
        cardUiSettingsBottomSheet.present()
      }
    })

    return () => subscription.remove()
  }, [])

  return (
    <UiBottomSheet
      enableDynamicSizing={true}
      ref={cardUiSettingsBottomSheet.ref}
      footerComponent={() => (
        <View
          className='flex w-full flex-row gap-2'
          style={{ paddingBottom: insets.bottom + 1, paddingHorizontal: 10 }}
        >
          <UiButton
            title='Cancel'
            variant='outlined'
            className='flex-1'
            onPress={() => cardUiSettingsBottomSheet.dismiss()}
          />
          <UiButton title='Generate proof' className='flex-1' onPress={generateProof} />
        </View>
      )}
      headerComponent={
        <BottomSheetHeader
          title='Settings'
          dismiss={cardUiSettingsBottomSheet.dismiss}
          className='px-5'
        />
      }
      backgroundStyle={{
        backgroundColor: palette.backgroundContainer,
      }}
      snapPoints={['50%']}
    >
      <UiHorizontalDivider />
      <BottomSheetScrollView>
        <View style={{ padding: 16 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Deep link params:</Text>
          <Text selectable>{modalParams ? JSON.stringify(modalParams, null, 2) : 'No params'}</Text>
        </View>
      </BottomSheetScrollView>
    </UiBottomSheet>
  )
}
