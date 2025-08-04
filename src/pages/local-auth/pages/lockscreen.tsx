import { useNavigation } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ErrorHandler, translate } from '@/core'
import BiometricsIcon from '@/pages/local-auth/components/BiometricsIcon'
import HiddenPasscodeView from '@/pages/local-auth/components/HiddenPasscodeView'
import type { LocalAuthStackScreenProps } from '@/route-types'
import { authStore, BiometricStatuses, localAuthStore, MAX_ATTEMPTS } from '@/store'
import { cn } from '@/theme'
import { UiButton, UiNumPad, UiScreenScrollable } from '@/ui'

const useUnlockWithBiometrics = () => {
  const tryUnlockWithBiometrics = localAuthStore.useLocalAuthStore(
    state => state.tryUnlockWithBiometrics,
  )

  const [isAttemptFailed, setIsAttemptFailed] = useState(false)

  const unlockWithBiometrics = useCallback(async () => {
    setIsAttemptFailed(false)
    try {
      const unlockStatus = await tryUnlockWithBiometrics()

      if (unlockStatus) {
        return
      }

      setIsAttemptFailed(true)
    } catch (error) {
      ErrorHandler.processWithoutFeedback(error)
      setIsAttemptFailed(true)
    }
  }, [tryUnlockWithBiometrics])

  return {
    unlockWithBiometrics,
    isAttemptFailed,
  }
}

// eslint-disable-next-line no-empty-pattern
export default function Lockscreen({}: LocalAuthStackScreenProps<'Lockscreen'>) {
  const biometricStatus = localAuthStore.useLocalAuthStore(state => state.biometricStatus)
  const attemptsLeft = localAuthStore.useLocalAuthStore(state => state.attemptsLeft)
  const lockDeadline = localAuthStore.useLocalAuthStore(state => state.lockDeadline)
  const PASSCODE_MAX_LENGTH = 4
  const checkLockDeadline = localAuthStore.useCheckLockDeadline()
  const { unlockWithBiometrics } = useUnlockWithBiometrics()
  const insets = useSafeAreaInsets()

  const [passcode, setPasscode] = useState('')

  const tryUnlockWithPasscode = localAuthStore.useLocalAuthStore(
    state => state.tryUnlockWithPasscode,
  )

  const submit = useCallback(
    async (value: string) => {
      if (!value) return

      if (tryUnlockWithPasscode(value)) {
        return
      }

      setPasscode('')
    },
    [tryUnlockWithPasscode],
  )
  const logout = authStore.useLogout()
  const navigation = useNavigation()
  const resetLocalAuthStore = localAuthStore.useLocalAuthStore(state => state.resetStore)
  const tryLogout = useCallback(async () => {
    logout()

    await resetLocalAuthStore()

    navigation.navigate('Auth', {
      screen: 'Intro',
    })
  }, [logout, navigation, resetLocalAuthStore])

  const handleSetPasscode = useCallback(
    async (value: string) => {
      if (value.length > 4) return

      setPasscode(value)

      if (value.length === 4) {
        await submit(value)
      }
    },
    [submit],
  )

  useEffect(() => {
    if (biometricStatus === BiometricStatuses.Enabled) {
      unlockWithBiometrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <UiScreenScrollable className={cn('flex flex-1 items-center justify-center')}>
      {lockDeadline || lockDeadline === Infinity ? (
        <View
          style={{
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
          className='w-full flex-1'
        >
          {lockDeadline === Infinity ? (
            <View className='flex flex-1 items-center gap-2 px-2'>
              <Text className={cn('typography-h4 my-auto text-center text-textPrimary')}>
                {translate('lockscreen.locked-permanently')}
              </Text>
              <UiButton
                className='mt-auto w-full'
                title={translate('lockscreen.logout-btn')}
                onPress={tryLogout}
              />
            </View>
          ) : (
            <View className='my-auto flex items-center gap-2'>
              <Text className={cn('typography-h4 text-center text-textPrimary')}>
                {translate('lockscreen.locked-temp')}
              </Text>
              <Text className={cn('typography-subtitle1 text-textPrimary')}>
                <Countdown deadline={lockDeadline} onFinish={checkLockDeadline} />
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View
          style={{
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
          className='w-full flex-1'
        >
          <View className={cn('my-auto flex w-full items-center gap-4 p-5')}>
            <Text className={cn('typography-h4 text-center text-textPrimary')}>
              {translate('lockscreen.default-title')}
            </Text>

            <HiddenPasscodeView length={passcode.length} maxLenght={PASSCODE_MAX_LENGTH} />

            {attemptsLeft < MAX_ATTEMPTS && (
              <Text className={cn('typography-subtitle1 text-textPrimary')}>
                {translate('lockscreen.attempts-left', {
                  attemptsLeft,
                })}
              </Text>
            )}
          </View>

          <View className={cn('flex w-full gap-10 p-5')}>
            {biometricStatus === BiometricStatuses.Enabled ? (
              <UiNumPad
                value={passcode}
                setValue={handleSetPasscode}
                // TODO: is it necessary? The BiometricsLockScreen will handle it
                extra={
                  <TouchableOpacity
                    className='flex-1 items-center justify-center'
                    onPress={() => unlockWithBiometrics()}
                  >
                    <View className='mt-1 flex-1 items-center justify-center'>
                      <BiometricsIcon size={32} />
                    </View>
                  </TouchableOpacity>
                }
              />
            ) : (
              <UiNumPad value={passcode} setValue={handleSetPasscode} />
            )}

            <UiButton
              variant='outlined'
              color='error'
              title={translate('lockscreen.forgot-btn')}
              onPress={tryLogout}
            />
          </View>
        </View>
      )}
    </UiScreenScrollable>
  )
}

function Countdown({ deadline, onFinish }: { deadline: number; onFinish: () => void }) {
  const [timeLeftInSeconds, setTimeLeftInSeconds] = useState(
    Math.trunc((deadline - Date.now()) / 1000),
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const timeLeftMilliSec = deadline - Date.now()

      if (timeLeftMilliSec <= 0) {
        onFinish()
        return
      }

      setTimeLeftInSeconds(Math.trunc(timeLeftMilliSec / 1000))
    }, 1000)

    return () => clearInterval(interval)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Text>{timeLeftInSeconds} Sec</Text>
}
