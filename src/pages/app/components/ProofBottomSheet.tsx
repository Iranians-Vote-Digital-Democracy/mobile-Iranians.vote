import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { QueryParams } from 'expo-linking'
import * as Linking from 'expo-linking'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppTheme } from '@/theme'
import { UiBottomSheet, UiHorizontalDivider, useUiBottomSheet } from '@/ui'
import { BottomSheetHeader } from '@/ui/UiBottomSheet'

export default function ProofBottomSheet() {
  const [modalParams, setModalParams] = useState<QueryParams | null>(null)
  const cardUiSettingsBottomSheet = useUiBottomSheet()
  const { palette } = useAppTheme()
  const insets = useSafeAreaInsets()

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
        setTimeout(() => {
          cardUiSettingsBottomSheet.present()
        }, 0)
      }
    })

    return () => subscription.remove()
  }, [])

  return (
    <UiBottomSheet
      ref={cardUiSettingsBottomSheet.ref}
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
      <BottomSheetScrollView style={{ paddingBottom: insets.bottom }}>
        <View style={{ padding: 16 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Deep link params:</Text>
          <Text selectable>{modalParams ? JSON.stringify(modalParams, null, 2) : 'No params'}</Text>
        </View>
      </BottomSheetScrollView>
    </UiBottomSheet>
  )
}
