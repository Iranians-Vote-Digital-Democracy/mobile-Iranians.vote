/* eslint-disable no-console */
/* eslint-disable unused-imports/no-unused-vars */
import { buildCertTreeAndGenProof, parseLdifString } from '@lukachi/rn-csca'
import { ECParameters } from '@peculiar/asn1-ecc'
import { id_pkcs_1, RSAPublicKey } from '@peculiar/asn1-rsa'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { getBytes, keccak256, toBeArray } from 'ethers'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AppContainer from '@/pages/app/components/AppContainer'
import { useAppPaddings } from '@/theme'
import { Registration__factory } from '@/types/contracts/factories/Registration__factory'
import { Registration2 } from '@/types/contracts/Registration'
import { UiButton, UiScreenScrollable } from '@/ui'
import { getCircuitHashAlgorithm } from '@/utils/circuits/helpers'
import { ECDSA_ALGO_PREFIX, EID, Sod } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'
import { getPublicKeyFromEcParameters } from '@/utils/e-document/helpers/crypto'

import { useRegistration } from '../document-scan/ScanProvider/hooks/registration'

const registrationContractInterface = Registration__factory.createInterface()

const newBuildRegisterCertCallData = async (
  CSCABytes: ArrayBuffer[],
  sigCertificate: ExtendedCertificate,
  masterCert: Certificate,
) => {
  const inclusionProofSiblings = buildCertTreeAndGenProof(
    CSCABytes,
    AsnConvert.serialize(masterCert),
  )

  if (inclusionProofSiblings.length === 0) {
    throw new TypeError('failed to generate inclusion proof')
  }

  console.log({ inclusionProofSiblings })

  const dispatcherName = (() => {
    const masterSubjPubKeyAlg = masterCert.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm

    if (masterSubjPubKeyAlg.includes(id_pkcs_1)) {
      const bits = (() => {
        if (
          sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm.includes(
            id_pkcs_1,
          )
        ) {
          const slaveRSAPubKey = AsnConvert.parse(
            sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey,
            RSAPublicKey,
          )

          const modulusBytes = new Uint8Array(slaveRSAPubKey.modulus)

          const unpaddedRsaPubKey =
            modulusBytes[0] === 0x00 ? modulusBytes.subarray(1) : modulusBytes

          return (unpaddedRsaPubKey.byteLength * 8).toString()
        }

        if (
          sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm.includes(
            ECDSA_ALGO_PREFIX,
          )
        ) {
          if (!sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters)
            throw new TypeError('ECDSA public key does not have parameters')

          const ecParameters = AsnConvert.parse(
            sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters,
            ECParameters,
          )

          const [publicKey] = getPublicKeyFromEcParameters(
            ecParameters,
            new Uint8Array(
              sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey,
            ),
          )

          const rawPoint = new Uint8Array([...toBeArray(publicKey.px), ...toBeArray(publicKey.py)])

          return rawPoint.length * 8
        }
      })()

      let dispatcherName = `C_RSA`

      const circuitHashAlgorithm = getCircuitHashAlgorithm(sigCertificate.certificate)
      if (circuitHashAlgorithm) {
        dispatcherName += `_${circuitHashAlgorithm}`
      }

      dispatcherName += `_${bits}`

      return dispatcherName
    }

    if (masterSubjPubKeyAlg.includes(ECDSA_ALGO_PREFIX)) {
      if (!masterCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters) {
        throw new TypeError('Master ECDSA public key does not have parameters')
      }

      if (!sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters) {
        throw new TypeError('Slave ECDSA public key does not have parameters')
      }

      const masterEcParameters = AsnConvert.parse(
        masterCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters,
        ECParameters,
      )

      const slaveEcParameters = AsnConvert.parse(
        sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters,
        ECParameters,
      )

      const [, , masterCertCurveName] = getPublicKeyFromEcParameters(
        masterEcParameters,
        new Uint8Array(masterCert.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey),
      )

      const [slaveCertPubKey] = getPublicKeyFromEcParameters(
        slaveEcParameters,
        new Uint8Array(
          sigCertificate.certificate.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey,
        ),
      )

      const pubKeyBytes = new Uint8Array([
        ...toBeArray(slaveCertPubKey.px),
        ...toBeArray(slaveCertPubKey.py),
      ])

      const bits = pubKeyBytes.length * 8

      let dispatcherName = `C_ECDSA_${masterCertCurveName}`

      const circuitHashAlgorithm = getCircuitHashAlgorithm(sigCertificate.certificate)
      if (circuitHashAlgorithm) {
        dispatcherName += `_${circuitHashAlgorithm}`
      }

      dispatcherName += `_${bits}`

      return dispatcherName
    }

    throw new Error(`unsupported public key type: ${masterSubjPubKeyAlg}`)
  })()

  const dispatcherHash = getBytes(keccak256(Buffer.from(dispatcherName, 'utf-8')))

  console.log({ dispatcherHash, dispatcherName })

  const certificate: Registration2.CertificateStruct = {
    dataType: dispatcherHash,
    signedAttributes: new Uint8Array(
      AsnConvert.serialize(sigCertificate.certificate.tbsCertificate),
    ),
    keyOffset: sigCertificate.slaveCertPubKeyOffset,
    expirationOffset: sigCertificate.slaveCertExpOffset,
  }
  console.log({ certificate })
  const icaoMember: Registration2.ICAOMemberStruct = {
    signature: sigCertificate.getSlaveCertIcaoMemberSignature(masterCert),
    publicKey: Sod.getSlaveCertIcaoMemberKey(masterCert),
  }
  console.log({ icaoMember })

  return registrationContractInterface.encodeFunctionData('registerCertificate', [
    certificate,
    icaoMember,
    inclusionProofSiblings.map(el => Buffer.from(el, 'hex')),
  ])
}

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
      return
    }

    setIsSubmitting(false)
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
