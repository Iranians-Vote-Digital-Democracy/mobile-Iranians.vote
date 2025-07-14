import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { parsePemString } from '@lukachi/rn-csca'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { JsonRpcProvider, zeroPadValue } from 'ethers'
import { Asset, useAssets } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { QueryParams } from 'expo-linking'
import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { Config } from '@/config'
import { createPoseidonSMTContract } from '@/helpers'
import { tryCatch } from '@/helpers/try-catch'
import { walletStore } from '@/store'
import { IdentityItem } from '@/store/modules/identity/Identity'
import { useAppTheme } from '@/theme'
import { UiBottomSheet, UiButton, UiHorizontalDivider, useUiBottomSheet } from '@/ui'
import { BottomSheetHeader } from '@/ui/UiBottomSheet'
import { QueryIdentityCircuit } from '@/utils/circuits/query-identity-circuits'
import { NoirEIDBasedRegistrationCircuit } from '@/utils/circuits/registration/noir-registration-circuit'
import { EID, EPassport } from '@/utils/e-document'
import { ExtendedCertificate } from '@/utils/e-document/extended-cert'

export default function ProofBottomSheet() {
  const [authAssets] = useAssets([require('@assets/certificates/AuthCert_0897A6C3.cer')])
  const [modalParams, setModalParams] = useState<QueryParams | null>(null)
  const cardUiSettingsBottomSheet = useUiBottomSheet()
  const privateKey = walletStore.useWalletStore.getState().privateKey
  const { palette } = useAppTheme()
  const insets = useSafeAreaInsets()

  const rmoEvmJsonRpcProvider = useMemo(() => {
    const evmRpcUrl = RARIMO_CHAINS[Config.RMO_CHAIN_ID].rpcEvm
    return new JsonRpcProvider(evmRpcUrl)
  }, [])

  const certPoseidonSMTContract = useMemo(() => {
    return createPoseidonSMTContract(
      Config.CERT_POSEIDON_SMT_CONTRACT_ADDRESS,
      rmoEvmJsonRpcProvider,
    )
  }, [rmoEvmJsonRpcProvider])

  const getSlaveCertSmtProof = useCallback(
    async (cert: ExtendedCertificate) => {
      return certPoseidonSMTContract.contractInstance.getProof(
        zeroPadValue(cert.slaveCertificateIndex, 32),
      )
    },
    [certPoseidonSMTContract.contractInstance],
  )

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
        getSlaveCertSmtProof(targetCertificate),
      )
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

      const identity = new IdentityItem(eID, regProof)
      console.log('✅ IdentityItem successfully created')

      return {
        identity,
        slaveCertSmtProof,
        targetCertificate,
        sigCert: eID.sigCertificate,
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

    const { identity, slaveCertSmtProof, targetCertificate, sigCert } =
      await getMinimalIdentityData()
    console.log('✅ [identity] Minimal identity data received')
    console.log('🧾 identity:', identity)
    console.log('🌿 slaveCertSmtProof.root:', slaveCertSmtProof.root)
    console.log('🌿 slaveCertSmtProof.siblings:', slaveCertSmtProof.siblings.length, 'siblings')

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

    const [_, getSlaveMasterError] = await tryCatch(targetCertificate.getSlaveMaster(CSCACertBytes))
    if (getSlaveMasterError) {
      console.error('❌ [CSCA] Failed to get slave master certificate')
      throw new TypeError('Failed to get slave master certificate', getSlaveMasterError)
    } else {
      console.log('✅ [CSCA] Slave master certificate verified')
    }

    console.log('🔑 [PrivateKey] Pulled from walletStore', privateKey)

    const dg1 = circuitParams.buildDg1FromTbs(sigCert.certificate.tbsCertificate)

    console.log('dg1', dg1)

    const inputs = circuitParams.buildInputs({
      skIdentity: String(BigInt(`0x${privateKey}`)),
      icaoRoot: String(BigInt(slaveCertSmtProof.root)),
      pkPassportHash: identity?.passportHash as string,
      dg1,
      // inclusionBranches: slaveCertSmtProof.siblings,
      inclusionBranches: slaveCertSmtProof.siblings.map(el => BigInt(el)).map(String),
    })

    console.log('🛠️ [Inputs] Prepared inputs for circuit')
    console.log(JSON.stringify(inputs, null, 2))

    const proof = await circuitParams.prove(JSON.stringify(inputs))
    // const proof = await circuitParams.prove(JSON.stringify(QueryIdentityCircuit.TEST_DATA))
    console.log('🎉 [Proof] Success! Proof generated')
    console.log('🧾 Proof:', proof)
  }

  useEffect(() => {
    const handleDeepLink = async () => {
      const url = await Linking.getInitialURL()
      if (!url) return

      const parsed = Linking.parse(url)
      const params = parsed.queryParams

      if (params && Object.keys(params).length > 0) {
        setModalParams(params)
        cardUiSettingsBottomSheet.present()
      }
    }

    handleDeepLink()
  }, [])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url)
      const params = parsed.queryParams

      if (params && Object.keys(params).length > 0) {
        setModalParams(params)
        cardUiSettingsBottomSheet.present()
      }
    })

    return () => subscription.remove()
  }, [])

  return (
    <UiBottomSheet
      enableDynamicSizing
      ref={cardUiSettingsBottomSheet.ref}
      footerComponent={() => (
        <View
          className='flex w-full flex-row gap-2'
          style={{ paddingBottom: insets.bottom + 1, paddingHorizontal: 10 }}
        >
          <UiButton
            title='Cancel'
            variant='outlined'
            className='flex-1'
            onPress={() => cardUiSettingsBottomSheet.dismiss()}
          />
          <UiButton title='Generate proof' className='flex-1' onPress={generateProof} />
        </View>
      )}
      headerComponent={
        <BottomSheetHeader
          title='Settings'
          dismiss={cardUiSettingsBottomSheet.dismiss}
          className='px-5'
        />
      }
      backgroundStyle={{ backgroundColor: palette.backgroundContainer }}
      snapPoints={['50%']}
    >
      <UiHorizontalDivider />
      <BottomSheetScrollView>
        <View style={{ padding: 16 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Deep link params:</Text>
          <Text selectable>{modalParams ? JSON.stringify(modalParams, null, 2) : 'No params'}</Text>
        </View>
      </BottomSheetScrollView>
    </UiBottomSheet>
  )
}
