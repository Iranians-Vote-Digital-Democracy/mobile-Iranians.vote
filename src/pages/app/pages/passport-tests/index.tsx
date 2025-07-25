/* eslint-disable no-console */
/* eslint-disable unused-imports/no-unused-vars */
import { parseLdifString } from '@lukachi/rn-csca'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { JsonRpcProvider } from 'ethers'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { NoirEIDRegistration } from '@/api/modules/registration/variants/noir-eid'
import { Config } from '@/config'
import { createProposalContract } from '@/helpers'
import AppContainer from '@/pages/app/components/AppContainer'
import { identityStore } from '@/store'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import { walletStore } from '@/store/modules/wallet'
import { useAppPaddings } from '@/theme'
import { UiButton, UiScreenScrollable } from '@/ui'
import { EIDBasedQueryIdentityCircuit } from '@/utils/circuits/eid-based-query-identity-circuit'
import { EID } from '@/utils/e-document'
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

const rmoProvider = new JsonRpcProvider(RARIMO_CHAINS[Config.RMO_CHAIN_ID].rpcEvm)
const proposalContract = createProposalContract(Config.PROPOSAL_STATE_CONTRACT_ADDRESS, rmoProvider)

export default function PassportTests() {
  const privateKey = walletStore.useWalletStore(state => state.privateKey)
  const publicKeyHash = walletStore.usePublicKeyHash()
  const addIdentity = identityStore.useIdentityStore(state => state.addIdentity)
  const identities = identityStore.useIdentityStore(state => state.identities)
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

      const newIdentity = await eIDRegistration.createIdentity(eID, privateKey, publicKeyHash)

      console.log('created new identity')
      // setIdentity(newIdentity as NoirEIDIdentity)
      addIdentity(newIdentity)
    } catch (error) {
      console.error('Error in testCert:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [addIdentity, privateKey, publicKeyHash])

  const generateProof = async () => {
    console.log('🔷 [generateProof] Started proof generation')

    console.log('✅ [circuit] QueryIdentityCircuit initialized')

    console.log('✅ [identity] Minimal identity data received')

    const currentIdentity = identities[identities.length - 1] // last registered identity

    if (!(currentIdentity instanceof NoirEIDIdentity))
      throw new Error('Identity is not NoirEIDIdentity')

    if (!currentIdentity) throw new Error("Identity doesn't exist")

    const circuitParams = new EIDBasedQueryIdentityCircuit(
      currentIdentity,
      proposalContract.contractInstance,
    )

    const inputs = {
      skIdentity: `0x${privateKey}`,
    }

    const proof = await circuitParams.prove(inputs)
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
