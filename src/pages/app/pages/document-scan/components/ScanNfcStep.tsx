import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Text, View } from 'react-native'

import { translate } from '@/core'
import { UiButton } from '@/ui'
import { initNfc, readSigningAndAuthCertificates } from '@/utils/e-document/inid-nfc-reader'

export default function ScanNfcStep() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // start NFC once, right after mount
  useEffect(() => {
    initNfc().catch(e => console.warn('NFC init error', e))
  }, [])

  // single handler – will be attached to the <Button>
  const onReadPress = useCallback(async () => {
    setBusy(true)
    setError(null)
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

      //console.log(AsnConvert.parse(Buffer.from(signingCert, 'hex'), Certificate))

      if (!authCert) throw new Error('Authentication certificate not found')

      //console.log(AsnConvert.parse(Buffer.from(authCert, 'hex'), Certificate))
    } catch (e) {
      console.error({ e })
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <View className='mb-20 mt-10 flex-1 justify-center p-6'>
      <Text className='typography-h5 mb-2 text-textPrimary'>NFC Reader</Text>
      <Text className='typography-body3 mb-6 text-textSecondary'>Reading personal data</Text>
      <Image
        source={require('@assets/images/passport-scan-example.png')}
        resizeMode='contain'
        className='my-6 size-[300px] self-center' // Added vertical margin
      />
      <Text className='typography-body3 mb-6 text-textSecondary'>
        {translate('tabs.scan-nfc.tip')}
      </Text>
      {busy && <ActivityIndicator className='my-4' />}
      {error && <Text className='typography-body2 mt-4 text-errorMain'>{error}</Text>}
      <UiButton
        title={busy ? 'Read Signing Certificate' : 'Start NFC Scan'}
        onPress={onReadPress}
        className='mt-auto w-full' // Used mt-auto to push button to bottom, adjusted if other elements are pushing it
        disabled={busy}
      />
    </View>
  )
}
