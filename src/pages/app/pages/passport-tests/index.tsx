/* eslint-disable unused-imports/no-unused-vars */
import { parseLdifString } from '@lukachi/rn-csca'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AppContainer from '@/pages/app/components/AppContainer'
import { useAppPaddings } from '@/theme'
import { Registration__factory } from '@/types/contracts/factories/Registration__factory'
import { UiButton, UiScreenScrollable } from '@/ui'
import { EID } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'

import { useRegistration } from '../document-scan/ScanProvider/hooks/registration'

const registrationContractInterface = Registration__factory.createInterface()

const downloadUrl =
  'https://www.googleapis.com/download/storage/v1/b/rarimo-temp/o/icaopkd-list.ldif?generation=1715355629405816&alt=media'
const icaopkdFileUri = `${FileSystem.documentDirectory}/icaopkd-list.ldif`

const getIcaoPkdLdifFile = async () => {
  const downloadResumable = FileSystem.createDownloadResumable(downloadUrl, icaopkdFileUri, {})

  if (!(await FileSystem.getInfoAsync(icaopkdFileUri)).exists) {
    await downloadResumable.downloadAsync()
  }

  const icaoLdif = await FileSystem.readAsStringAsync(icaopkdFileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  })

  return parseLdifString(icaoLdif)
}

function decToHex(d: string): string {
  return '0x' + BigInt(d).toString(16)
}

function ensureHex(s: string): string {
  return s.startsWith('0x') ? s : decToHex(s)
}

export default function PassportTests() {
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()
  const bottomBarHeight = useBottomTabBarHeight()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const { createIdentity } = useRegistration()

  const testCert = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const [authAsset] = await Asset.loadAsync(
        require('@assets/certificates/AuthCert_0897A6C3.cer'),
      )

      if (!authAsset.localUri) throw new Error('authAsset local URI is not available')

      const authAssetInfo = await FileSystem.getInfoAsync(authAsset.localUri)

      if (!authAssetInfo.uri) throw new Error('authAsset local URI is not available')

      const authFileContent = await FileSystem.readAsStringAsync(authAssetInfo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const authContentBytes = Buffer.from(authFileContent, 'base64')

      const authCertificate = new ExtendedCertificate(
        AsnConvert.parse(authContentBytes, Certificate),
      )

      // ------------------------------------------------------------------------------------------------------------------------------

      const [signingCertAsset] = await Asset.loadAsync(
        require('@assets/certificates/SigningCert_084384FC.cer'),
      )

      if (!signingCertAsset.localUri) throw new Error('signingCertAsset local URI is not available')

      const signingCertAssetInfo = await FileSystem.getInfoAsync(signingCertAsset.localUri)

      if (!signingCertAssetInfo.uri) throw new Error('signingCertAsset local URI is not available')

      const signingCertFileContent = await FileSystem.readAsStringAsync(signingCertAssetInfo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const signingCertFileContentBytes = Buffer.from(signingCertFileContent, 'base64')

      const sigCertificate = new ExtendedCertificate(
        AsnConvert.parse(signingCertFileContentBytes, Certificate),
      )

      // ------------------------------------------------------------------------------------------------------------------------------

      const eID = new EID(sigCertificate, authCertificate)

      await createIdentity(eID, {
        onRevocation: () => {},
      })
    } catch (error) {
      console.error('Error in testCert:', error)
    } finally {
      setIsSubmitting(true)
    }
  }, [createIdentity])

  // const testNoir = useCallback(async () => {
  //   // TODO: Replace with the correct circuit after its release
  //   const noirInstance = NoirCircuitParams.fromName('registerIdentity_26_512_3_3_336_248_NA')
  //   const RAW_TEST_INPUTS = JSON.parse(Config.TEST_INPUTS) as {
  //     dg1: string[]
  //     dg15: string[]
  //     ec: string[]
  //     icao_root: string
  //     inclusion_branches: string[]
  //     pk: string[]
  //     reduction_pk: string[]
  //     sa: string[]
  //     sig: string[]
  //     sk_identity: string
  //   }

  //   /**
  //    * IMPORTANT: All values in HEX_INPUTS must be hexadecimal strings
  //    * and include the '0x' prefix.
  //    */
  //   const HEX_INPUTS = {
  //     dg1: RAW_TEST_INPUTS.dg1.map(decToHex),
  //     dg15: RAW_TEST_INPUTS.dg15.map(decToHex),
  //     ec: RAW_TEST_INPUTS.ec.map(decToHex),
  //     icao_root: ensureHex(RAW_TEST_INPUTS.icao_root),
  //     inclusion_branches: RAW_TEST_INPUTS.inclusion_branches.map(decToHex),
  //     pk: RAW_TEST_INPUTS.pk.map(ensureHex),
  //     reduction_pk: RAW_TEST_INPUTS.reduction_pk.map(ensureHex),
  //     sa: RAW_TEST_INPUTS.sa.map(decToHex),
  //     sig: RAW_TEST_INPUTS.sig.map(ensureHex),
  //     sk_identity: ensureHex(RAW_TEST_INPUTS.sk_identity),
  //   }

  //   await NoirCircuitParams.downloadTrustedSetup({
  //     // TODO: Add download trusted setup UI progress if needed
  //     // onDownloadingProgress: downloadProgress => {
  //     //   console.log('progress:', downloadProgress)
  //     // },
  //   })

  //   // TODO: replace test `@assets/noir_dl.json` with noirInstance.downloadByteCode()
  //   // after its release
  //   // const bytesCodeString = await noirInstance.downloadByteCode()
  //   const bytesCodeString = JSON.stringify(require('@assets/noir_dl.json'))

  //   const inputsJson = JSON.stringify(HEX_INPUTS)

  //   const proof = await noirInstance.prove(inputsJson, bytesCodeString)
  //   console.log('Proof:', proof)
  // }, [])

  return (
    <AppContainer>
      <UiScreenScrollable
        style={{
          paddingTop: insets.top,
          paddingBottom: bottomBarHeight,
          paddingLeft: appPaddings.left,
          paddingRight: appPaddings.right,
        }}
        className='gap-3'
      >
        <View className='flex gap-4'>
          <UiButton disabled={isSubmitting} onPress={testCert} title='Test Cert' />
        </View>
      </UiScreenScrollable>
    </AppContainer>
  )
}
