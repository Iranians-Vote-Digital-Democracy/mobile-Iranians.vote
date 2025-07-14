import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton, UiIcon } from '@/ui'
import { EID } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'
import { initNfc, readSigningAndAuthCertificates } from '@/utils/e-document/inid-nfc-reader'

export default function ScanNfcStep() {
  const { setTempEDoc } = useDocumentScanContext()

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
    <View className='flex flex-1 flex-col justify-center'>
      <Text className='typography-h5 text-center text-textPrimary'>Scan process</Text>
      {busy ? (
        <View className='flex items-center'>
          <UiIcon customIcon='bellFillIcon' className='size-[120] text-textPrimary' />
        </View>
      ) : (
        <UiButton onPress={onReadPress} title='Try Scan Again' />
      )}
    </View>
  )
}
