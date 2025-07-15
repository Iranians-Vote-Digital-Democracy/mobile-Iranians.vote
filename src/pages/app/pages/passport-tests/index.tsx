/* eslint-disable unused-imports/no-unused-vars */
import { parseLdifString, parsePemString } from '@lukachi/rn-csca'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RegistrationStrategy } from '@/api/modules/registration/strategy'
import { NoirEIDRegistration } from '@/api/modules/registration/variants/noir-eid'
import { tryCatch } from '@/helpers/try-catch'
import AppContainer from '@/pages/app/components/AppContainer'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import { walletStore } from '@/store/modules/wallet'
import { useAppPaddings } from '@/theme'
import { UiButton, UiScreenScrollable } from '@/ui'
import { QueryIdentityCircuit } from '@/utils/circuits/query-identity-circuits'
import { NoirEIDBasedRegistrationCircuit } from '@/utils/circuits/registration/noir-registration-circuit'
import { EID, EPassport } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'

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

const eIDRegistration = new NoirEIDRegistration()

export default function PassportTests() {
  const privateKey = walletStore.useWalletStore(state => state.privateKey)
  const publicKeyHash = walletStore.usePublicKeyHash()

  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()
  const bottomBarHeight = useBottomTabBarHeight()

  const [isSubmitting, setIsSubmitting] = useState(false)

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
      await eIDRegistration.revokeIdentity()
      console.log('revoked')

      await eIDRegistration.createIdentity(eID, privateKey, publicKeyHash)
    } catch (error) {
      console.error('Error in testCert:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [privateKey, publicKeyHash])

  const getMinimalIdentityData = async () => {
    try {
      console.log('📦 Loading AuthCert...')
      const [authAsset] = await Asset.loadAsync(
        require('@assets/certificates/AuthCert_0897A6C3.cer'),
      )
      console.log('✅ AuthCert loaded:', authAsset.localUri)

      const authBase64 = await FileSystem.readAsStringAsync(authAsset.localUri!, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const authBytes = Buffer.from(authBase64, 'base64')
      const authCertificate = new ExtendedCertificate(AsnConvert.parse(authBytes, Certificate))
      console.log('🔍 AuthCert parsed successfully')

      console.log('📦 Loading SigningCert...')
      const [signingAsset] = await Asset.loadAsync(
        require('@assets/certificates/SigningCert_084384FC.cer'),
      )
      console.log('✅ SigningCert loaded:', signingAsset.localUri)

      const signingBase64 = await FileSystem.readAsStringAsync(signingAsset.localUri!, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const signingBytes = Buffer.from(signingBase64, 'base64')
      const signingCertificate = new ExtendedCertificate(
        AsnConvert.parse(signingBytes, Certificate),
      )
      console.log('🔍 SigningCert parsed successfully')

      const eID = new EID(signingCertificate, authCertificate)

      console.log('🧬 EID created')

      const targetCertificate =
        eID instanceof EPassport ? eID.sod.slaveCertificate : eID.authCertificate
      console.log('🎯 Target cert selected:', eID instanceof EPassport ? 'EPassport' : 'EID')

      const [slaveCertSmtProof, getProofErr] = await tryCatch(
        RegistrationStrategy.getSlaveCertSmtProof(targetCertificate),
      )
      console.log('slaveCertSmtProof from getSlaveCertSmtProof')
      if (getProofErr) {
        console.error('❌ SMT proof fetch failed:', getProofErr)
        throw new Error('SMT proof fetch failed')
      }

      console.log('✅ SMT proof fetched')

      const circuit = new NoirEIDBasedRegistrationCircuit(eID)
      const [regProof, getRegProofError] = await tryCatch(
        circuit.prove({
          skIdentity: BigInt(`0x${privateKey}`),
          icaoRoot: BigInt(slaveCertSmtProof.root),
          inclusionBranches: slaveCertSmtProof.siblings.map(el => BigInt(el)),
        }),
      )

      if (getRegProofError) {
        throw new TypeError('Failed to get identity registration proof', getRegProofError)
      }

      const identity = new NoirEIDIdentity(eID, regProof)

      console.log('✅ IdentityItem successfully created')

      return {
        identity,
        slaveCertSmtProof,
        signingBytes,
        // targetCertificate,
        // sigCert: eID.sigCertificate,
      }
    } catch (err) {
      console.error('🔥 Error in getMinimalIdentityData:', err)
      throw err
    }
  }

  const generateProof = async () => {
    console.log('🔷 [generateProof] Started proof generation')

    const circuitParams = new QueryIdentityCircuit()
    console.log('✅ [circuit] QueryIdentityCircuit initialized')

    const { identity, slaveCertSmtProof, signingBytes } = await getMinimalIdentityData()
    console.log('✅ [identity] Minimal identity data received')
    // console.log('🌿 slaveCertSmtProof.root:', identity.registrationProof.)
    // console.log('🌿 slaveCertSmtProof.siblings:', slaveCertSmtProof.siblings.length, 'siblings')

    const [CSCAPemAsset] = await Asset.loadAsync(require('@assets/certificates/master_000316.pem'))
    console.log('📦 [CSCA] Asset loaded')

    if (!CSCAPemAsset.localUri) throw new Error('❌ CSCA cert asset local URI is not available')
    const CSCAPemFileInfo = await FileSystem.getInfoAsync(CSCAPemAsset.localUri)
    const CSCAPemFileContent = await FileSystem.readAsStringAsync(CSCAPemFileInfo.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    })
    console.log('✅ [CSCA] File content read')

    const CSCACertBytes = parsePemString(CSCAPemFileContent)
    console.log('✅ [CSCA] PEM parsed into cert bytes')

    // const [_, getSlaveMasterError] = await tryCatch(targetCertificate.getSlaveMaster(CSCACertBytes))
    const [_, getSlaveMasterError] = await tryCatch(
      identity.document.authCertificate.getSlaveMaster(CSCACertBytes),
    )
    if (getSlaveMasterError) {
      console.error('❌ [CSCA] Failed to get slave master certificate')
      throw new TypeError('Failed to get slave master certificate', getSlaveMasterError)
    } else {
      console.log('✅ [CSCA] Slave master certificate verified')
    }

    console.log('🔑 [PrivateKey] Pulled from walletStore', privateKey)

    // const dg1 = circuitParams.buildDg1FromTbs(
    //   identity.document.sigCertificate.certificate.tbsCertificate,
    // )

    const rawTbsCertBytes = new Uint8Array(
      AsnConvert.serialize(identity.document.sigCertificate.certificate.tbsCertificate),
    )

    const dg1 = Array.from(circuitParams.getDg1(rawTbsCertBytes))

    console.log('dg1', dg1)

    // console.log('slaveCertSmtProof.root', slaveCertSmtProof.root)
    //   val proofIndex = Identity.calculateProofIndex(
    //     passportInfoKey,
    //     if (lightProofData == null) identityManager.registrationProof.value!!.pub_signals[3]
    //     else identityManager.registrationProof.value!!.pub_signals[2]
    // )

    // IMPORTANT!!!!!!!
    // identity.identityKey // 1
    // identity.pkIdentityHash // 2

    // identity.registrationProof.pub_signals[0]
    // identity.registrationProof.pub_signals[3]

    const passportProofIndexHex = await RegistrationStrategy.getPassportProofIndex(
      identity.identityKey,
      identity.pkIdentityHash,
    )

    console.log('identity.dg1Commitment', identity.dg1Commitment)

    const [passportInfo_, identityInfo_] = await identity.getPassportInfo()
    const identityReissueCounter = passportInfo_[1].toString()
    const issueTimestamp = identityInfo_[1].toString()

    console.log('passportProofIndexHex', passportProofIndexHex)

    const passportRegistrationProof =
      await RegistrationStrategy.getPassportRegistrationProof(passportProofIndexHex)

    console.log('passportRegistrationProof', passportRegistrationProof)

    console.log('identity.passportHash getting...')
    console.log('identity.passportHash', JSON.stringify(identity.passportHash, null, 2))
    const inputs = circuitParams.buildInputs({
      skIdentity: String(BigInt(`0x${privateKey}`)),
      // icaoRoot: slaveCertSmtProof.root,
      icaoRoot: String(BigInt(passportRegistrationProof.root)),
      pkPassportHash: identity?.passportHash as string,
      dg1,
      // inclusionBranches: slaveCertSmtProof.siblings,
      inclusionBranches: passportRegistrationProof.siblings.map(el => BigInt(el)).map(String),
      identityCounter: identityReissueCounter,
      timestamp: issueTimestamp,
    })

    console.log('🛠️ [Inputs] Prepared inputs for circuit')
    console.log(JSON.stringify(inputs, null, 2))

    const proof = await circuitParams.prove(JSON.stringify(inputs))
    // const proof = await circuitParams.prove(JSON.stringify(QueryIdentityCircuit.TEST_DATA))
    console.log('🎉 [Proof] Success! Proof generated')
    console.log('🧾 Proof:', proof)
  }

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
          <UiButton disabled={isSubmitting} onPress={generateProof} title='Test query proof' />
        </View>
      </UiScreenScrollable>
    </AppContainer>
  )
}
