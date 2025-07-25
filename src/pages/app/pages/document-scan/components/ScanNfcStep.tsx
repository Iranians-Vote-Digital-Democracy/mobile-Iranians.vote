import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { Image } from 'expo-image'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { translate } from '@/core'
import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton } from '@/ui'
import { EID } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'
import { initNfc, readSigningAndAuthCertificates } from '@/utils/e-document/inid-nfc-reader'

export default function ScanNfcStep() {
  const { setTempEDoc } = useDocumentScanContext()

  const [busy, setBusy] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // start NFC once, right after mount
  useEffect(() => {
    initNfc().catch(e => console.warn('NFC init error', e))
  }, [])

  const onReadPress = useCallback(async () => {
    setBusy(true)
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
      console.error({ e })
    }

    setBusy(false)
    setIsScanning(false)
  }, [setTempEDoc])

  // const pk = walletStore.useWalletStore(state => state.privateKey)
  // const registrationChallenge = walletStore.useRegistrationChallenge()

  return (
    <View className='mb-19 mt-10 flex-1 justify-center p-6'>
      <Text className='typography-h5 mb-2 text-textPrimary'>NFC Reader</Text>
      <Text className='typography-body3 mb-6 text-textSecondary'>Reading personal data</Text>
      {isScanning && (
        <Text className='typography-body2 mb-6 rounded-xl border-componentPrimary bg-componentPrimary p-4 text-center text-textPrimary'>
          Scanning NFC tag... Please hold your passport close to the phone.
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
      <Text className='typography-body3 mb-6 text-textSecondary'>
        {translate('tabs.scan-nfc.tip')}
      </Text>
      {busy && <ActivityIndicator className='my-4' />}
      {/* {error && <Text className='mt-4 text-errorMain typography-body2'>{error}</Text>} */}
      <UiButton
        onPress={onReadPress}
        title={busy ? 'Read Signing Certificate' : 'Start NFC Scan'}
        className='mt-auto w-full'
        disabled={busy}
      />
    </View>
  )
}
