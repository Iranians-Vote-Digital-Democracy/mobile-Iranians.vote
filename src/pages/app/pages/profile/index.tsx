import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { BottomSheetView } from '@gorhom/bottom-sheet'
import { version } from 'package.json'
import { ReactNode, useCallback, useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'

import { useSelectedLanguage } from '@/core'
import { type Language, resources } from '@/core/localization/resources'
import { useCopyToClipboard } from '@/hooks'
import { AppTabScreenProps } from '@/route-types'
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
          'border- w-full rounded-[20px] border px-5 py-4',
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
      <View className={cn('w-full flex-row items-center justify-between rounded-[20px] px-5 py-4')}>
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
      >
        <View className='flex flex-1 flex-col gap-4'>
          <ProfileCard />
          <SettingsCard />
          <AppVersionCard />
        </View>
      </UiScreenScrollable>
    </AppContainer>
  )
}

function ProfileCard() {
  const privateKey = walletStore.useWalletStore(state => state.privateKey)
  const publicKeyHash = walletStore.usePublicKeyHash().toString()
  const { isCopied, copy } = useCopyToClipboard()

  const avatar = createAvatar(identicon, {
    seed: publicKeyHash,
  }).toString()

  const bottomSheet = useUiBottomSheet()

  return (
    <>
      <Pressable onPress={bottomSheet.present} className='w-full items-center'>
        <View className='w-full items-center justify-center'>
          <View className='size-[85px] items-center overflow-hidden rounded-full bg-componentPrimary'>
            <SvgXml height={80} width={80} xml={avatar} />
          </View>

          <Text className='typography-body1 mt-2 text-center text-textPrimary'>Stranger</Text>
        </View>
      </Pressable>

      <UiBottomSheet
        title='Profile'
        detached={true}
        ref={bottomSheet.ref}
        enableDynamicSizing={false}
        snapPoints={['40%']}
      >
        <BottomSheetView className='w-full gap-3'>
          <UiCard>
            <Text className='typography-body2 text-textPrimary'>Your private key:</Text>
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
          <LogoutCard />
        </BottomSheetView>
      </UiBottomSheet>
    </>
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
        detached={true}
        enableDynamicSizing={false}
        snapPoints={['30%']}
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
        detached={true}
        enableDynamicSizing={false}
        snapPoints={['30%']}
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
      <UiBottomSheet
        detached={true}
        title='Auth Method'
        ref={authMethodBottomSheet.ref}
        enableDynamicSizing={false}
        snapPoints={['30%']}
      >
        <BottomSheetView
          style={{
            paddingBottom: insets.bottom + 20,
            paddingLeft: appPaddings.left,
            paddingRight: appPaddings.right,
            paddingTop: 20,
          }}
          className='gap-6'
        >
          <View className='w-full flex-row gap-2 rounded-[20px] border border-componentPrimary px-2 py-4'>
            <UiIcon className='color-textPrimary' customIcon='passwordIcon' />
            <Text className='typography-body2 text-textPrimary'>Passcode</Text>
            <UiSwitcher
              value={isPasscodeEnabled}
              onValueChange={handleChangePasscodeStatus}
              style={{
                transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
                marginLeft: 150,
              }}
            />
          </View>

          {isBiometricsEnrolled && (
            <View className='w-full flex-row gap-2 rounded-[20px] border border-componentPrimary px-2 py-4'>
              <UiIcon
                className={!isPasscodeEnabled ? 'color-textSecondary' : 'color-textPrimary'}
                customIcon='fingerprintIcon'
              />
              <Text
                className={cn(
                  'typography-body2',
                  !isPasscodeEnabled ? 'text-textSecondary' : 'text-textPrimary',
                )}
              >
                Biometric
              </Text>
              <UiSwitcher
                value={isBiometricsEnabled}
                onValueChange={handleChangeBiometricStatus}
                disabled={!isPasscodeEnabled}
                style={{
                  transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
                  marginLeft: 150,
                }}
              />
            </View>
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
