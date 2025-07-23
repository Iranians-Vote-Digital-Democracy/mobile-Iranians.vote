import { BottomSheetView } from '@gorhom/bottom-sheet'
import { version } from 'package.json'
import { ReactNode, useCallback, useMemo } from 'react'
import { Text, View } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSelectedLanguage } from '@/core'
import { type Language, resources } from '@/core/localization/resources'
import { useCopyToClipboard } from '@/hooks'
import type { AppTabScreenProps } from '@/route-types'
import {
  authStore,
  BiometricStatuses,
  localAuthStore,
  PasscodeStatuses,
  walletStore,
} from '@/store'
import { cn, useAppPaddings, useBottomBarOffset, useSelectedTheme } from '@/theme'
import {
  UiBottomSheet,
  UiButton,
  UiCard,
  UiIcon,
  UiScreenScrollable,
  UiSwitcher,
  useUiBottomSheet,
} from '@/ui'

import AppContainer from '../../components/AppContainer'

// eslint-disable-next-line no-empty-pattern
export default function ProfileScreen({}: AppTabScreenProps<'Profile'>) {
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()
  const offset = useBottomBarOffset()

  return (
    <AppContainer>
      <UiScreenScrollable
        style={{
          paddingTop: insets.top,
          paddingLeft: appPaddings.left,
          paddingRight: appPaddings.right,
          paddingBottom: offset,
        }}
        className='gap-3'
      >
        <View className='flex flex-1 flex-col justify-center gap-4'>
          <ProfileCard />
          <SettingsCard />
          <LogoutCard />
          <AppVersionCard />
        </View>
      </UiScreenScrollable>
    </AppContainer>
  )
}

function ProfileCard() {
  const privateKey = walletStore.useWalletStore(state => state.privateKey)
  const { isCopied, copy } = useCopyToClipboard()

  return (
    <UiCard>
      <Text className='typography-body2 ms-3 text-textPrimary'>Your private key:</Text>
      <UiCard className='mt-2 bg-backgroundPrimary'>
        <Text className='typography-body3 text-textPrimary'>{privateKey}</Text>
      </UiCard>

      <UiButton
        variant='text'
        color='text'
        leadingIconProps={{
          customIcon: isCopied ? 'checkIcon' : 'copySimpleIcon',
        }}
        title='Copy to Clipboard'
        onPress={() => copy(privateKey)}
      />
    </UiCard>
  )
}

function LangCard() {
  // TODO: reload app after change language
  const { language, setLanguage } = useSelectedLanguage()
  const languageBottomSheet = useUiBottomSheet()
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()

  return (
    <>
      <View className='flex w-full flex-col gap-4'>
        <ProfileButton
          title='Language'
          icon={<UiIcon customIcon='earthLineIcon' className='text-textPrimary' size={24} />}
          onPress={languageBottomSheet.present}
          selectedVariant={`${language}`}
        />
      </View>
      <UiBottomSheet
        title={`Current language: ${language}`}
        ref={languageBottomSheet.ref}
        enableDynamicSizing={true}
      >
        <BottomSheetView
          className='mt-3 w-full gap-2'
          style={{
            paddingBottom: insets.bottom + 20,

            paddingLeft: appPaddings.left,
            paddingRight: appPaddings.right,
          }}
        >
          {Object.keys(resources).map(el => (
            <OptionButton
              key={el}
              title={el}
              isSelected={language === el}
              onPress={() => {
                setLanguage(el as Language)
                languageBottomSheet.dismiss()
              }}
            />
          ))}
        </BottomSheetView>
      </UiBottomSheet>
    </>
  )
}

function ThemeCard() {
  const { selectedTheme, setSelectedTheme } = useSelectedTheme()
  const themeBottomSheet = useUiBottomSheet()
  const appPaddings = useAppPaddings()
  const insets = useSafeAreaInsets()

  return (
    <>
      <View className='flex w-full flex-col gap-4'>
        <ProfileButton
          title='Theme'
          onPress={themeBottomSheet.present}
          selectedVariant={`${selectedTheme}`}
          icon={<UiIcon customIcon='paletteIcon' className='text-textPrimary' size={24} />}
        />
      </View>
      <UiBottomSheet
        title={`Current theme: ${selectedTheme}`}
        ref={themeBottomSheet.ref}
        enableDynamicSizing={true}
      >
        <BottomSheetView
          className='mt-3 gap-3'
          style={{
            paddingBottom: insets.bottom + 20,
            paddingLeft: appPaddings.left,
            paddingRight: appPaddings.right,
          }}
        >
          <View className={cn('flex flex-col gap-2')}>
            <OptionButton
              title='Light'
              isSelected={selectedTheme === 'light'}
              onPress={() => {
                setSelectedTheme('light')
                themeBottomSheet.dismiss()
              }}
            />
            <OptionButton
              title='Dark'
              isSelected={selectedTheme === 'dark'}
              onPress={() => {
                setSelectedTheme('dark')
                themeBottomSheet.dismiss()
              }}
            />
            <OptionButton
              title='System'
              isSelected={selectedTheme === 'system'}
              onPress={() => {
                setSelectedTheme('system')
                themeBottomSheet.dismiss()
              }}
            />
          </View>
        </BottomSheetView>
      </UiBottomSheet>
    </>
  )
}

function LocalAuthMethodCard() {
  const passcodeStatus = localAuthStore.useLocalAuthStore(state => state.passcodeStatus)
  const biometricStatus = localAuthStore.useLocalAuthStore(state => state.biometricStatus)
  const disablePasscode = localAuthStore.useLocalAuthStore(state => state.disablePasscode)
  const disableBiometric = localAuthStore.useLocalAuthStore(state => state.disableBiometrics)
  const authMethodBottomSheet = useUiBottomSheet()
  const setPasscodeStatus = localAuthStore.useLocalAuthStore(state => state.setPasscodeStatus)
  const setBiometricsStatus = localAuthStore.useLocalAuthStore(state => state.setBiometricsStatus)
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()

  const isPasscodeEnabled = useMemo(
    () => passcodeStatus === PasscodeStatuses.Enabled,
    [passcodeStatus],
  )

  const isBiometricsEnrolled = useMemo(() => {
    return ![BiometricStatuses.NotSupported, BiometricStatuses.NotEnrolled].includes(
      biometricStatus,
    )
  }, [biometricStatus])

  const isBiometricsEnabled = useMemo(
    () => biometricStatus === BiometricStatuses.Enabled,
    [biometricStatus],
  )

  const handleChangePasscodeStatus = useCallback(() => {
    if (isPasscodeEnabled) {
      disablePasscode()

      return
    }

    setPasscodeStatus(PasscodeStatuses.NotSet)
  }, [disablePasscode, isPasscodeEnabled, setPasscodeStatus])

  const handleChangeBiometricStatus = useCallback(() => {
    if (biometricStatus === BiometricStatuses.Enabled) {
      disableBiometric()

      return
    }

    setBiometricsStatus(BiometricStatuses.NotSet)
  }, [biometricStatus, disableBiometric, setBiometricsStatus])

  return (
    <>
      <View className='flex w-full flex-col gap-4'>
        <ProfileButton
          title='Auth methods'
          onPress={authMethodBottomSheet.present}
          icon={<UiIcon customIcon='shieldCheckIcon' className='text-textPrimary' size={24} />}
        />
      </View>
      <UiBottomSheet title='Auth Method' ref={authMethodBottomSheet.ref}>
        <BottomSheetView
          style={{
            paddingBottom: insets.bottom + 20,
            paddingLeft: appPaddings.left,
            paddingRight: appPaddings.right,
          }}
          className='gap-3'
        >
          <UiSwitcher
            label='Passcode'
            value={isPasscodeEnabled}
            onValueChange={handleChangePasscodeStatus}
            style={{
              transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
              marginLeft: 230,
            }}
          />
          {isBiometricsEnrolled && (
            <UiSwitcher
              label='Biometric'
              value={isBiometricsEnabled}
              onValueChange={handleChangeBiometricStatus}
              disabled={!isPasscodeEnabled}
              style={{
                transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
                marginLeft: 230,
              }}
            />
          )}
        </BottomSheetView>
      </UiBottomSheet>
    </>
  )
}

function LogoutCard() {
  const logout = authStore.useLogout()

  return (
    <UiCard>
      <UiButton
        color='error'
        title='delete account'
        trailingIconProps={{
          customIcon: 'trashSimpleIcon',
        }}
        onPress={logout}
      />
    </UiCard>
  )
}

function AppVersionCard() {
  return (
    <UiCard className='items-center'>
      <Text className='typography-body3 text-textSecondary'>App Version: {version} </Text>
    </UiCard>
  )
}

function SettingsCard() {
  return (
    <UiCard className='items-center gap-3'>
      <Text className='typography-body2 text-textPrimary'>Settings</Text>
      <LocalAuthMethodCard />
      <LangCard />
      <ThemeCard />
    </UiCard>
  )
}

function OptionButton({
  title,
  isSelected,
  onPress,
}: {
  title: string
  isSelected: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        className={cn(
          'w-full rounded-lg border px-5 py-4',
          isSelected ? 'border-textPrimary bg-componentPrimary' : 'border-componentPrimary',
        )}
      >
        <Text className='typography-subtitle4 text-center text-textPrimary'>{title}</Text>
      </View>
    </Pressable>
  )
}

function ProfileButton({
  title,
  icon,
  selectedVariant,
  onPress,
}: {
  title: string
  icon?: ReactNode
  selectedVariant?: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      <View className={cn('w-full flex-row items-center justify-between px-5 py-4')}>
        <View className='flex-row items-center gap-4'>
          {icon}
          <Text className='typography-subtitle4 text-textPrimary'>{title}</Text>
        </View>

        <View className='flex-row items-center gap-2'>
          {selectedVariant && (
            <Text className='typography-body2 text-textSecondary'>{selectedVariant}</Text>
          )}

          <UiIcon customIcon='caretRightIcon' className='text-textSecondary' size={20} />
        </View>
      </View>
    </Pressable>
  )
}
