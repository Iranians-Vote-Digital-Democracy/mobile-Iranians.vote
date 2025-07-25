import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { Image } from 'expo-image'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { translate } from '@/core'
import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton } from '@/ui'
import { EID } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'
import { initNfc, readSigningAndAuthCertificates } from '@/utils/e-document/inid-nfc-reader'

export default function ScanNfcStep() {
  const { setTempEDoc } = useDocumentScanContext()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)

  // start NFC once, right after mount
  useEffect(() => {
    initNfc().catch(e => console.warn('NFC init error', e))
  }, [])

  const onReadPress = useCallback(async () => {
    setBusy(true)
    try {
      // const signingCertHex = await readSigningCertificate()

      // if (!signingCertHex) throw new Error('Signing certificate not found')

      // console.log(AsnConvert.parse(Buffer.from(signingCertHex, 'hex'), Certificate))

      // await sleep(2_000)

      // const authCertHex = await readAuthenticationCertificate()

      // if (!authCertHex) throw new Error('Authentication certificate not found')

      // console.log(AsnConvert.parse(Buffer.from(authCertHex, 'hex'), Certificate))

      const { signingCert, authCert } = await readSigningAndAuthCertificates()

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
  }, [setTempEDoc])

  // const pk = walletStore.useWalletStore(state => state.privateKey)
  // const registrationChallenge = walletStore.useRegistrationChallenge()

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className='mb-19 mt-10 flex-1 justify-center p-6'
    >
      <Text className='typography-h5 mb-2 text-textPrimary'>NFC Reader</Text>
      <Text className='typography-body3 mb-6 text-textSecondary'>Reading personal data</Text>
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
