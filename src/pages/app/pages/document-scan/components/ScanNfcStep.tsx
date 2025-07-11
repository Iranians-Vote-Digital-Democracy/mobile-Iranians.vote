import { AsnConvert } from '@peculiar/asn1-schema'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { UiButton } from '@/ui'
import { initNfc } from '@/utils/e-document/inid-nfc-reader'

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

      console.log(AsnConvert.parse(Buffer.from(signingCert, 'hex'), Certificate))

      if (!authCert) throw new Error('Authentication certificate not found')

      console.log(AsnConvert.parse(Buffer.from(authCert, 'hex'), Certificate))
    } catch (e) {
      console.error({ e })
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      {busy && <ActivityIndicator />}
      {error && <Text className='bg-errorLight text-errorMain typography-body2'>{error}</Text>}
      <UiButton
        title='Read Signing Certificate'
        onPress={onReadPress}
        className='mb-auto w-full'
        disabled={busy}
      />
    </View>
  )
}
