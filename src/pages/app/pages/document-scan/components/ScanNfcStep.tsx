import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useNavigation } from '@react-navigation/core'
import { Image } from 'expo-image'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { translate } from '@/core'
import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton, UiIcon } from '@/ui'
import { DocType, EID } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'
import {
  initNfc,
  readSigningAndAuthCertificates,
  stopNfc,
} from '@/utils/e-document/inid-nfc-reader'
import {
  initPassportNfc,
  scanPassport,
  stopPassportNfc,
} from '@/utils/e-document/passport-nfc-reader'

export default function ScanNfcStep() {
  const { setTempEDoc, docType, tempMRZ } = useDocumentScanContext()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation()

  const isPassportMode = docType === DocType.PASSPORT

  // Initialize NFC based on document type
  useEffect(() => {
    if (isPassportMode) {
      initPassportNfc().catch(e => console.warn('Passport NFC init error', e))
    } else {
      initNfc().catch(e => console.warn('NFC init error', e))
    }
  }, [isPassportMode])

  // Read EID (Iranian National ID)
  const onReadEIDPress = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const { signingCert, authCert } = await readSigningAndAuthCertificates(() => {
        setIsScanning(true)
      })

      if (!signingCert) throw new Error('Signing certificate not found')

      const extendedSigCert = new ExtendedCertificate(
        AsnConvert.parse(Buffer.from(signingCert, 'hex'), Certificate),
      )

      if (!authCert) throw new Error('Authentication certificate not found')

      const extendedAuthCert = new ExtendedCertificate(
        AsnConvert.parse(Buffer.from(authCert, 'hex'), Certificate),
      )

      const eID = new EID(extendedSigCert, extendedAuthCert)
      setTempEDoc(eID)
    } catch (e) {
      console.error('EID read error:', e)
      setError(e instanceof Error ? e.message : 'Failed to read ID card')
    }

    setBusy(false)
    setIsScanning(false)
  }, [setTempEDoc])

  // Read Passport using MRZ data
  const onReadPassportPress = useCallback(async () => {
    console.warn('[NFC-STEP] Starting passport read...', { tempMRZ })

    if (!tempMRZ) {
      console.error('[NFC-STEP] ERROR: No MRZ data')
      setError('Please scan MRZ first')
      return
    }

    if (!tempMRZ.documentNumber || !tempMRZ.birthDate || !tempMRZ.expirationDate) {
      console.error('[NFC-STEP] ERROR: Invalid MRZ data', {
        documentNumber: tempMRZ.documentNumber,
        birthDate: tempMRZ.birthDate,
        expirationDate: tempMRZ.expirationDate,
      })
      setError('Invalid MRZ data')
      return
    }

    console.warn('[NFC-STEP] MRZ validated, starting NFC scan...')
    setBusy(true)
    setError(null)
    setIsScanning(true)

    try {
      console.warn('[NFC-STEP] Calling scanPassport with:', {
        documentNumber: tempMRZ.documentNumber,
        dateOfBirth: tempMRZ.birthDate,
        dateOfExpiry: tempMRZ.expirationDate,
      })

      const ePassport = await scanPassport({
        documentNumber: tempMRZ.documentNumber,
        dateOfBirth: tempMRZ.birthDate,
        dateOfExpiry: tempMRZ.expirationDate,
      })

      console.warn('[NFC-STEP] Passport read SUCCESS!', {
        docCode: ePassport.docCode,
        firstName: ePassport.personDetails.firstName,
        lastName: ePassport.personDetails.lastName,
        documentNumber: ePassport.personDetails.documentNumber,
      })

      setTempEDoc(ePassport)

      console.warn('[NFC-STEP] EPassport saved to context')
    } catch (e) {
      console.error('[NFC-STEP] Passport read FAILED:', e)
      setError(e instanceof Error ? e.message : 'Failed to read passport')
    }

    setBusy(false)
    setIsScanning(false)

    console.warn('[NFC-STEP] Scan complete')
  }, [tempMRZ, setTempEDoc])

  const handleClose = useCallback(() => {
    if (isPassportMode) {
      stopPassportNfc()
    } else {
      stopNfc()
    }
    navigation.navigate('App', { screen: 'Tabs' })
  }, [isPassportMode, navigation])

  const onReadPress = isPassportMode ? onReadPassportPress : onReadEIDPress

  return (
    <View
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
      className='flex-1 justify-center p-6'
    >
      <View className='flex-row'>
        <Text className='typography-h5 mb-2 text-textPrimary'>
          {isPassportMode ? 'Passport NFC Reader' : 'ID Card NFC Reader'}
        </Text>
        <View className='flex-1' />
        <Pressable className='absolute right-[15px] top-[15px]' onPress={handleClose}>
          <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
            <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
          </View>
        </Pressable>
      </View>

      <Text className='typography-body3 mb-6 text-textSecondary'>
        {isPassportMode
          ? 'Hold your passport against the back of your phone'
          : 'Reading personal data from ID card'}
      </Text>

      {isPassportMode && tempMRZ && (
        <View className='mb-4 rounded-xl bg-componentPrimary p-4'>
          <Text className='typography-body3 text-textSecondary'>
            Document: {tempMRZ.documentNumber}
          </Text>
          <Text className='typography-body3 text-textSecondary'>DOB: {tempMRZ.birthDate}</Text>
          <Text className='typography-body3 text-textSecondary'>
            Expiry: {tempMRZ.expirationDate}
          </Text>
        </View>
      )}

      {isScanning && (
        <Text className='typography-body2 mb-6 rounded-xl border-componentPrimary bg-componentPrimary p-4 text-center text-textPrimary'>
          Scanning NFC... Please hold your {isPassportMode ? 'passport' : 'ID card'} close to the
          phone.
        </Text>
      )}

      {!isScanning && busy && (
        <Text className='typography-body2 mb-6 rounded-xl border-componentPrimary bg-componentPrimary p-4 text-center text-textPrimary'>
          Place your {isPassportMode ? 'passport' : 'ID card'} against the back of your phone
        </Text>
      )}

      <Image
        source={require('@assets/images/passport-scan-example.png')}
        style={{
          width: 300,
          height: 300,
          alignSelf: 'center',
          marginBottom: 24,
          marginTop: 24,
        }}
      />

      <Text className='typography-body3 text-textSecondary'>{translate('tabs.scan-nfc.tip')}</Text>

      {busy && <ActivityIndicator className='my-4' />}

      {error && <Text className='typography-body2 my-4 text-center text-errorMain'>{error}</Text>}

      <UiButton
        onPress={onReadPress}
        title={busy ? 'Scanning...' : `Scan ${isPassportMode ? 'Passport' : 'ID Card'}`}
        className='mt-auto w-full'
        disabled={busy || (isPassportMode && !tempMRZ)}
      />
    </View>
  )
}
