import { useNavigation } from '@react-navigation/native'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ErrorHandler, translate } from '@/core'
import type { LocalAuthStackScreenProps } from '@/route-types'
import { BiometricStatuses, localAuthStore } from '@/store'
import { cn } from '@/theme'
import { UiButton, UiNumPad, UiScreenScrollable } from '@/ui'

// eslint-disable-next-line no-empty-pattern
export default function SetPasscode({}: LocalAuthStackScreenProps<'SetPasscode'>) {
  const [passcode, setPasscode] = useState('')

  const [firstPasscode, setFirstPasscode] = useState<string | null>(null)

  const [errorVisible, setErrorVisible] = useState(false)

  const setPasscodeStore = localAuthStore.useLocalAuthStore(state => state.setPasscode)
  const biometricStatus = localAuthStore.useLocalAuthStore(state => state.biometricStatus)

  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const submit = useCallback(async () => {
    if (passcode.length !== 4) return

    if (firstPasscode === null) {
      setFirstPasscode(passcode)
      setPasscode('')
    } else {
      if (passcode === firstPasscode) {
        try {
          setPasscodeStore(passcode)

          if (biometricStatus === BiometricStatuses.NotSet) {
            navigation.navigate('LocalAuth', {
              screen: 'EnableBiometrics',
            })
            return
          }
        } catch (error) {
          ErrorHandler.processWithoutFeedback(error)
        }
      } else {
        setErrorVisible(true)
        setPasscode('')
      }
    }
  }, [passcode, firstPasscode, setPasscodeStore, biometricStatus, navigation])

  const handleSetPasscode = useCallback((value: string) => {
    if (value.length > 4) return
    setPasscode(value)
  }, [])

  const titleText =
    firstPasscode === null
      ? translate('set-passcode.title')
      : translate('set-passcode.reenter-title')

  const subtitleText = errorVisible
    ? translate('set-passcode.error-mismatch')
    : firstPasscode === null
      ? translate('set-passcode.subtitle')
      : translate('set-passcode.reenter-subtitle')

  return (
    <UiScreenScrollable
      style={{
        bottom: insets.bottom,
      }}
    >
      <View className={cn('flex-1')}>
        <View className={cn('my-auto flex w-full items-center gap-4 p-5')}>
          <View>
            <Text className={cn('typography-h4 text-center text-textPrimary')}>{titleText}</Text>
            <Text
              className={cn('typography-body-3 text-center', {
                'text-errorMain': errorVisible,
                'text-textSecondary': !errorVisible,
              })}
            >
              {subtitleText}
            </Text>
          </View>

          <View className='flex h-[16] flex-row items-center gap-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <View
                key={i}
                className={cn(
                  'size-[16] rounded-full',
                  i < passcode.length ? 'bg-primaryMain' : 'bg-textSecondary',
                )}
              />
            ))}
          </View>
        </View>

        <View className={cn('flex w-full gap-6 p-5')}>
          <UiNumPad value={passcode} setValue={handleSetPasscode} />
          <UiButton
            title={translate('set-passcode.submit-btn')}
            onPress={submit}
            disabled={passcode.length !== 4}
          />
        </View>
      </View>
    </UiScreenScrollable>
  )
}
