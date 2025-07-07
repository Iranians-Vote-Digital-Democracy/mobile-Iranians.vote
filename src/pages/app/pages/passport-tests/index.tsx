import { Hex } from '@iden3/js-crypto'
import { NoirCircuitParams } from '@modules/noir'
import { CertificateSet, ContentInfo, SignedData } from '@peculiar/asn1-cms'
import { ECParameters } from '@peculiar/asn1-ecc'
import { id_pkcs_1, RSAPublicKey } from '@peculiar/asn1-rsa'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { getBytes, keccak256, toBeArray } from 'ethers'
import * as FileSystem from 'expo-file-system'
import forge from 'node-forge'
import { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Config } from '@/config'
import AppContainer from '@/pages/app/components/AppContainer'
import { identityStore } from '@/store'
import { useAppPaddings } from '@/theme'
import { Registration__factory } from '@/types/contracts/factories/Registration__factory'
import { Registration2 } from '@/types/contracts/Registration'
import { UiButton, UiScreenScrollable } from '@/ui'
import { getCircuitHashAlgorithm } from '@/utils/circuits/helpers'
import { CertTree } from '@/utils/circuits/helpers/treap-tree'
import { RegistrationCircuit } from '@/utils/circuits/registration-circuit'
import { ECDSA_ALGO_PREFIX, EDocument, PersonDetails } from '@/utils/e-document'
import { getPublicKeyFromEcParameters } from '@/utils/e-document/helpers/crypto'

const registrationContractInterface = Registration__factory.createInterface()

const newBuildRegisterCertCallData = async (
  CSCAs: Certificate[],
  tempEDoc: EDocument,
  masterCert: Certificate,
) => {
  const icaoTree = await CertTree.buildFromX509(CSCAs)

  const inclusionProof = icaoTree.genInclusionProof(masterCert)

  const root = icaoTree.tree.merkleRoot()

  if (!root) throw new TypeError('failed to generate inclusion proof')

  console.log('root', Hex.encodeString(root))

  if (inclusionProof.siblings.length === 0) {
    throw new TypeError('failed to generate inclusion proof')
  }

  const dispatcherName = (() => {
    const masterSubjPubKeyAlg = masterCert.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm

    if (masterSubjPubKeyAlg.includes(id_pkcs_1)) {
      const bits = (() => {
        if (
          tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm.includes(
            id_pkcs_1,
          )
        ) {
          const slaveRSAPubKey = AsnConvert.parse(
            tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey,
            RSAPublicKey,
          )

          const modulusBytes = new Uint8Array(slaveRSAPubKey.modulus)

          const unpaddedRsaPubKey =
            modulusBytes[0] === 0x00 ? modulusBytes.subarray(1) : modulusBytes

          return (unpaddedRsaPubKey.byteLength * 8).toString()
        }

        if (
          tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm.includes(
            ECDSA_ALGO_PREFIX,
          )
        ) {
          if (!tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters)
            throw new TypeError('ECDSA public key does not have parameters')

          const ecParameters = AsnConvert.parse(
            tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters,
            ECParameters,
          )

          const [publicKey] = getPublicKeyFromEcParameters(
            ecParameters,
            new Uint8Array(
              tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey,
            ),
          )

          const rawPoint = new Uint8Array([...toBeArray(publicKey.px), ...toBeArray(publicKey.py)])

          return rawPoint.length * 8
        }
      })()

      let dispatcherName = `C_RSA`

      const circuitHashAlgorithm = getCircuitHashAlgorithm(tempEDoc.sod.slaveCert)
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

      if (!tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters) {
        throw new TypeError('Slave ECDSA public key does not have parameters')
      }

      const masterEcParameters = AsnConvert.parse(
        masterCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters,
        ECParameters,
      )

      const slaveEcParameters = AsnConvert.parse(
        tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters,
        ECParameters,
      )

      const [, , masterCertCurveName] = getPublicKeyFromEcParameters(
        masterEcParameters,
        new Uint8Array(masterCert.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey),
      )

      const [slaveCertPubKey] = getPublicKeyFromEcParameters(
        slaveEcParameters,
        new Uint8Array(tempEDoc.sod.slaveCert.tbsCertificate.subjectPublicKeyInfo.subjectPublicKey),
      )

      const pubKeyBytes = new Uint8Array([
        ...toBeArray(slaveCertPubKey.px),
        ...toBeArray(slaveCertPubKey.py),
      ])

      const bits = pubKeyBytes.length * 8

      let dispatcherName = `C_ECDSA_${masterCertCurveName}`

      const circuitHashAlgorithm = getCircuitHashAlgorithm(tempEDoc.sod.slaveCert)
      if (circuitHashAlgorithm) {
        dispatcherName += `_${circuitHashAlgorithm}`
      }

      dispatcherName += `_${bits}`

      return dispatcherName
    }

    throw new Error(`unsupported public key type: ${masterSubjPubKeyAlg}`)
  })()

  const dispatcherHash = getBytes(keccak256(Buffer.from(dispatcherName, 'utf-8')))

  const certificate: Registration2.CertificateStruct = {
    dataType: dispatcherHash,
    signedAttributes: new Uint8Array(AsnConvert.serialize(tempEDoc.sod.slaveCert.tbsCertificate)),
    keyOffset: tempEDoc.sod.slaveCertPubKeyOffset,
    expirationOffset: tempEDoc.sod.slaveCertExpOffset,
  }
  const icaoMember: Registration2.ICAOMemberStruct = {
    signature: tempEDoc.sod.getSlaveCertIcaoMemberSignature(masterCert),
    publicKey: tempEDoc.sod.getSlaveCertIcaoMemberKey(masterCert),
  }

  const icaoMerkleProofSiblings = inclusionProof.siblings.flat()

  return registrationContractInterface.encodeFunctionData('registerCertificate', [
    certificate,
    icaoMember,
    icaoMerkleProofSiblings,
  ])
}

const downloadUrl =
  'https://www.googleapis.com/download/storage/v1/b/rarimo-temp/o/icaopkd-list.ldif?generation=1715355629405816&alt=media'
const icaopkdFileUri = `${FileSystem.documentDirectory}/icaopkd-list.ldif`

const icaoPkdStringToCerts = (icaoLdif: string): Certificate[] => {
  const regex = /pkdMasterListContent:: (.*?)\n\n/gs
  const matches = icaoLdif.matchAll(regex)

  const newLinePattern = /\n /g

  const certs: Certificate[][] = Array.from(matches, match => {
    // Remove newline + space patterns
    const dataB64 = match[1].replace(newLinePattern, '')

    // Decode base64
    const decoded = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0))

    const ci = AsnConvert.parse(decoded, ContentInfo)
    const signedData = AsnConvert.parse(ci.content, SignedData)

    if (!signedData.encapContentInfo.eContent?.single?.buffer) {
      throw new Error('eContent is missing in SignedData')
    }

    const asn1ContentInfo = forge.asn1.fromDer(
      forge.util.createBuffer(signedData.encapContentInfo.eContent?.single?.buffer),
    )

    const content = asn1ContentInfo.value[1] as forge.asn1.Asn1

    const CSCACerts = AsnConvert.parse(
      Buffer.from(forge.asn1.toDer(content).toHex(), 'hex'),
      CertificateSet,
    )

    return CSCACerts.reduce((acc, cert) => {
      if (cert.certificate) {
        acc.push(cert.certificate)
      }

      return acc
    }, [] as Certificate[])
  })

  return certs.flat()
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

  const testEDoc = identityStore.useIdentityStore(state => state.testEDoc)

  const downloadResumable = useMemo(() => {
    return FileSystem.createDownloadResumable(downloadUrl, icaopkdFileUri, {})
  }, [])

  const test = useCallback(
    async (passp: string, _eDoc?: EDocument) => {
      setIsSubmitting(true)
      try {
        const eDoc = (() => {
          if (_eDoc) return _eDoc

          const passport = JSON.parse(passp)

          // console.log(passport.dg1)

          return new EDocument({
            docCode: 'P',
            personDetails: {} as PersonDetails,
            dg1Bytes: new Uint8Array(Buffer.from(passport.dg1, 'base64')),
            sodBytes: new Uint8Array(Buffer.from(passport.sod, 'base64')),
            ...(passport.dg15 && {
              dg15Bytes: new Uint8Array(Buffer.from(passport.dg15, 'base64')),
            }),
          })
        })()

        // console.log(Buffer.from(eDoc.sodBytes).toString('base64'))

        // console.log(eDoc.dg1Bytes)

        const circuit = new RegistrationCircuit(eDoc)
        console.log(circuit.name, circuit)

        // console.log(eDoc.sod.slaveCertExpOffset)

        // console.log(Buffer.from(eDoc.dg1Bytes).toString('base64'))
        // console.log(Buffer.from(eDoc.sodBytes).toString('base64'))

        // console.log(
        //   'slave cert pem',
        //   Buffer.from(
        //     toPem(Buffer.from(AsnConvert.serialize(eDoc.sod.slaveCert)).buffer, 'CERTIFICATE'),
        //     'utf-8',
        //   ).toString('base64'),
        // )

        // const x509SlaveCert = new X509Certificate(AsnConvert.serialize(eDoc.sod.slaveCert))

        // console.log({ x509SlaveCert, slaveCert: eDoc.sod.slaveCert })

        // console.log(Hex.encodeString(eDoc.sod.slaveCertificateIndex))

        // if (!(await FileSystem.getInfoAsync(icaopkdFileUri)).exists) {
        //   await downloadResumable.downloadAsync()
        // }

        // const icaoLdif = await FileSystem.readAsStringAsync(icaopkdFileUri, {
        //   encoding: FileSystem.EncodingType.UTF8,
        // })

        // const CSCACertBytes = parseLdifString(icaoLdif)

        // const slaveMaster = await eDoc.sod.getSlaveMaster(CSCACertBytes)

        // console.log(
        //   'inclusionProof',
        //   inclusionProof.siblings.map(el => Hex.encodeString(getBytes(el))),
        // )

        // console.log(
        //   'slave',
        //   Hex.encodeString(new Uint8Array(AsnConvert.serialize(eDoc.sod.slaveCert))),
        // )

        // console.log(
        //   'slaveMaster',
        //   Hex.encodeString(new Uint8Array(AsnConvert.serialize(slaveMaster))),
        // )

        // const slaveCertIcaoMemberKey = eDoc.sod.getSlaveCertIcaoMemberKey(slaveMaster)

        // console.log('slaveCertIcaoMemberKey', Hex.encodeString(slaveCertIcaoMemberKey))
        // console.log(
        //   'extractRawPubKey(masterCert)',
        //   Hex.encodeString(extractRawPubKey(eDoc.sod.slaveCert)),
        // )

        // console.log(
        //   Buffer.from(
        //     toPem(Buffer.from(AsnConvert.serialize(slaveMaster)).buffer, 'CERTIFICATE'),
        //     'utf-8',
        //   ).toString('base64'),
        // )
        // console.log(Hex.encodeString(eDoc.sod.getSlaveCertIcaoMemberSignature(slaveMaster)))

        // console.log(CSCACertBytes.length)

        // const CSCACerts = CSCACertBytes.map(el => {
        //   return AsnConvert.parse(el, Certificate)
        // })

        // const icaoTree = await CertTree.buildFromX509(CSCACerts)

        // const inclusionProof = icaoTree.genInclusionProof(masterCert)

        // const root = icaoTree.tree.merkleRoot()

        // if (!root) throw new TypeError('failed to generate inclusion proof')

        // console.log('root', Hex.encodeString(root))

        // const callData = await newBuildRegisterCertCallData(CSCACerts, eDoc, slaveMaster)

        // console.log(callData)
      } catch (error) {
        console.error('Error during test:', error)
      }
      setIsSubmitting(false)
    },
    [downloadResumable],
  )

  const testNoir = useCallback(async () => {
    const noirInstance = NoirCircuitParams.fromName('registerIdentity_26_512_3_3_336_248_NA')
    const RAW_TEST_INPUTS = JSON.parse(Config.TEST_INPUTS) as {
      dg1: string[]
      dg15: string[]
      ec: string[]
      icao_root: string
      inclusion_branches: string[]
      pk: string[]
      reduction_pk: string[]
      sa: string[]
      sig: string[]
      sk_identity: string
    }

    /**
     * IMPORTANT: All values in HEX_INPUTS must be hexadecimal strings
     * and include the '0x' prefix.
     */
    const HEX_INPUTS = {
      dg1: RAW_TEST_INPUTS.dg1.map(decToHex),
      dg15: RAW_TEST_INPUTS.dg15.map(decToHex),
      ec: RAW_TEST_INPUTS.ec.map(decToHex),
      icao_root: ensureHex(RAW_TEST_INPUTS.icao_root),
      inclusion_branches: RAW_TEST_INPUTS.inclusion_branches.map(decToHex),
      pk: RAW_TEST_INPUTS.pk.map(ensureHex),
      reduction_pk: RAW_TEST_INPUTS.reduction_pk.map(ensureHex),
      sa: RAW_TEST_INPUTS.sa.map(decToHex),
      sig: RAW_TEST_INPUTS.sig.map(ensureHex),
      sk_identity: ensureHex(RAW_TEST_INPUTS.sk_identity),
    }

    await NoirCircuitParams.downloadTrustedSetup({
      // TODO: Add download trusted setup UI progress if needed
      // onDownloadingProgress: downloadProgress => {
      //   console.log('progress:', downloadProgress)
      // },
    })

    const byteCode = await noirInstance.downloadByteCode()

    const inputsJson = JSON.stringify(HEX_INPUTS)

    const proof = await noirInstance.prove(inputsJson, byteCode)

    console.log('Proof:', proof)
  }, [])

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
          <UiButton title='Test noir' onPress={testNoir} />
          {/* <UiButton
            disabled={isSubmitting}
            onPress={() => test(Config.PASSPORT_1)}
            title='Test 1'
          />
          <UiButton
            disabled={isSubmitting}
            onPress={() => test(Config.PASSPORT_2)}
            title='Test 2'
          />
          <UiButton
            disabled={isSubmitting}
            onPress={() => test(Config.PASSPORT_3)}
            title='Test 3'
          />
          <UiButton
            disabled={isSubmitting}
            onPress={() => test(Config.PASSPORT_4)}
            title='Test 4'
          />
          <UiButton
            disabled={isSubmitting}
            onPress={() => test(Config.PASSPORT_5)}
            title='Test 5'
          />
          <UiButton
            disabled={isSubmitting}
            onPress={() => test(Config.PASSPORT_6)}
            title='Test 6'
          />
          /> */}
          <UiButton disabled={isSubmitting} onPress={() => test('', testEDoc)} title='Test rsa' />
        </View>
      </UiScreenScrollable>
    </AppContainer>
  )
}
