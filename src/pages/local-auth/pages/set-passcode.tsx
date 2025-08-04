import { useNavigation } from '@react-navigation/native'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ErrorHandler, translate } from '@/core'
import type { LocalAuthStackScreenProps } from '@/route-types'
import { BiometricStatuses, localAuthStore } from '@/store'
import { cn } from '@/theme'
import { UiButton, UiNumPad, UiScreenScrollable } from '@/ui'

import HiddenPasscodeView from '../components/HiddenPasscodeView'

// eslint-disable-next-line no-empty-pattern
export default function SetPasscode({}: LocalAuthStackScreenProps<'SetPasscode'>) {
  const [passcode, setPasscode] = useState('')
  const [repeatPasscode, setRepeatPasscode] = useState('')

  const [isRepeatPasscode, setIsRepeatPasscode] = useState(false)

  const [errorMessageVisible, setErrorMessageVisible] = useState(false)

  const setPasscodeStore = localAuthStore.useLocalAuthStore(state => state.setPasscode)
  const biometricStatus = localAuthStore.useLocalAuthStore(state => state.biometricStatus)

  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const PASSCODE_MAX_LENGTH = 4

  const submit = useCallback(async () => {
    if (!isRepeatPasscode) return

    if (!repeatPasscode) return

    if (passcode !== repeatPasscode) {
      setErrorMessageVisible(true)
      return
    }

    try {
      setPasscodeStore(passcode)

      if (biometricStatus === BiometricStatuses.NotSet) {
        navigation.navigate('LocalAuth', {
          screen: 'EnableBiometrics',
        })
      }
    } catch (error) {
      ErrorHandler.processWithoutFeedback(error)
    }
  }, [isRepeatPasscode, repeatPasscode, passcode, setPasscodeStore, biometricStatus, navigation])

  const handleInputPasscode = useCallback((value: string) => {
    if (value.length > PASSCODE_MAX_LENGTH) return
    setPasscode(value)
  }, [])

  const handleInputRepeatPasscode = useCallback((value: string) => {
    if (value.length > PASSCODE_MAX_LENGTH) return
    setRepeatPasscode(value)
  }, [])

  return (
    <UiScreenScrollable
      style={{
        bottom: insets.bottom,
      }}
    >
      <View className={cn('flex-1')}>
        <View className={cn('my-auto flex w-full items-center gap-4 p-5')}>
          <View>
            <Text className={cn('typography-h4 text-center text-textPrimary')}>
              {repeatPasscode === null
                ? translate('set-passcode.title')
                : translate('set-passcode.reenter-title')}
            </Text>
            <Text
              className={cn('typography-body-3 text-center', {
                'text-errorMain': errorMessageVisible,
                'text-textSecondary': !errorMessageVisible,
              })}
            >
              {errorMessageVisible
                ? translate('set-passcode.error-mismatch')
                : repeatPasscode === null
                  ? translate('set-passcode.subtitle')
                  : translate('set-passcode.reenter-subtitle')}
            </Text>
          </View>

          <HiddenPasscodeView
            length={isRepeatPasscode ? repeatPasscode.length : passcode.length}
            maxLenght={PASSCODE_MAX_LENGTH}
          />
        </View>

        <View className={cn('flex w-full gap-6 p-5')}>
          <UiNumPad
            value={isRepeatPasscode ? repeatPasscode : passcode}
            setValue={isRepeatPasscode ? handleInputRepeatPasscode : handleInputPasscode}
          />
          <UiButton
            title={translate('set-passcode.submit-btn')}
            onPress={repeatPasscode ? submit : () => setIsRepeatPasscode(true)}
            disabled={
              repeatPasscode
                ? passcode.length !== PASSCODE_MAX_LENGTH
                : repeatPasscode.length !== PASSCODE_MAX_LENGTH
            }
          />

          {isRepeatPasscode && (
            <UiButton
              title='Reset'
              variant='outlined'
              onPress={() => {
                setPasscode('')
                setRepeatPasscode('')
                setIsRepeatPasscode(false)
              }}
            />
          )}
        </View>
      </View>
    </UiScreenScrollable>
  )
}
