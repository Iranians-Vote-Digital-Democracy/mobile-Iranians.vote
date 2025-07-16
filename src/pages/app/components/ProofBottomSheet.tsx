import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { AsnConvert } from '@peculiar/asn1-schema'
import * as Linking from 'expo-linking'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RegistrationStrategy } from '@/api/modules/registration/strategy'
import { bus, DefaultBusEvents, ErrorHandler } from '@/core'
import { identityStore, walletStore } from '@/store'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import { useAppTheme } from '@/theme'
import { UiBottomSheet, UiButton, UiHorizontalDivider, useUiBottomSheet } from '@/ui'
import { BottomSheetHeader } from '@/ui/UiBottomSheet'
import { QueryIdentityCircuit } from '@/utils/circuits/query-identity-circuits'
import { UrlQueryProofParams } from '@/utils/circuits/types/QueryIdentity'

export default function ProofBottomSheet() {
  const [modalParams, setModalParams] = useState<Partial<UrlQueryProofParams> | null>(null)
  const { dismiss, present, ref } = useUiBottomSheet()
  const { palette } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [isGenerating, setIsGenerating] = useState(false)
  const identities = identityStore.useIdentityStore(state => state.identities)
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  const generateProof = async () => {
    try {
      setIsGenerating(true)

      const circuitParams = new QueryIdentityCircuit()

      if (!identities.length) {
        // TODO: Implement registration in this case
        throw new Error("Your identity hasn't registered yet!")
      }

      // last registered identity
      const currentIdentity = identities[identities.length - 1]

      if (!(currentIdentity instanceof NoirEIDIdentity))
        throw new Error('Identity is not NoirEIDIdentity')

      if (!currentIdentity) throw new Error("Identity doesn't exist")

      const rawTbsCertBytes = new Uint8Array(
        AsnConvert.serialize(currentIdentity.document.sigCertificate.certificate.tbsCertificate),
      )

      const passportProofIndexHex = await RegistrationStrategy.getPassportProofIndex(
        currentIdentity.identityKey, // passport hash  (passportKey)
        currentIdentity.pkIdentityHash, // registrationProof.pub_signals[3] (IdentityKey)
      )

      const [passportInfo_, identityInfo_] = await currentIdentity.getPassportInfo()
      const identityReissueCounter = passportInfo_.identityReissueCounter.toString()
      const issueTimestamp = identityInfo_.issueTimestamp.toString()

      const passportRegistrationProof =
        await RegistrationStrategy.getPassportRegistrationProof(passportProofIndexHex)

      const dg1 = Array.from(circuitParams.getDg1(rawTbsCertBytes)).map(String)

      const inputs = circuitParams.buildQueryProofParams({
        ...modalParams,
        skIdentity: `0x${privateKey}`,
        idStateRoot: passportRegistrationProof.root,
        pkPassportHash: `0x${currentIdentity.passportHash}`,
        dg1,
        siblings: passportRegistrationProof.siblings,
        identityCounter: identityReissueCounter,
        timestamp: issueTimestamp,
      })

      await circuitParams.prove(JSON.stringify(inputs))
      // TODO: Implement verifying query proof with contract
      bus.emit(DefaultBusEvents.success, {
        message: 'Proof generated successfully!',
      })
      dismiss()
    } catch (error) {
      ErrorHandler.process(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const params = useMemo(
    () =>
      [
        {
          title: 'Selector',
          value: modalParams?.selector,
          visible: Boolean(modalParams?.selector),
        },
        {
          title: 'Event data',
          value: modalParams?.eventData,
          visible: Boolean(modalParams?.eventData),
        },
        {
          title: 'Event id',
          value: modalParams?.eventId,
          visible: Boolean(modalParams?.eventId),
        },
        {
          title: 'Citizenship mask',
          value: modalParams?.citizenshipMask,
          visible: Boolean(modalParams?.citizenshipMask),
        },
        {
          title: 'Timestamp lower',
          value: modalParams?.timestampLower,
          visible: Boolean(modalParams?.timestampLower),
        },
        {
          title: 'Timestamp upper',
          value: modalParams?.timestampUpper,
          visible: Boolean(modalParams?.timestampUpper),
        },
        {
          title: 'Timestamp',
          value: modalParams?.timestamp,
          visible: Boolean(modalParams?.timestamp),
        },
        {
          title: 'Identity counter',
          value: modalParams?.identityCounter,
          visible: Boolean(modalParams?.identityCounter),
        },
        {
          title: 'Identity count lower',
          value: modalParams?.identityCountLower,
          visible: Boolean(modalParams?.identityCountLower),
        },
        {
          title: 'Identity count upper',
          value: modalParams?.identityCountUpper,
          visible: Boolean(modalParams?.identityCountUpper),
        },
        {
          title: 'Birth date lower',
          value: modalParams?.birthDateLower,
          visible: Boolean(modalParams?.birthDateLower),
        },
        {
          title: 'Birth date upper',
          value: modalParams?.birthDateUpper,
          visible: Boolean(modalParams?.birthDateUpper),
        },
        {
          title: 'Expiration date lower',
          value: modalParams?.expirationDateLower,
          visible: Boolean(modalParams?.expirationDateLower),
        },
        {
          title: 'Expiration date upper',
          value: modalParams?.expirationDateUpper,
          visible: Boolean(modalParams?.expirationDateUpper),
        },
      ].filter(item => item.visible),
    [modalParams],
  )

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url)
      const params = parsed.queryParams
      if (!params) {
        setModalParams(null)
        return
      }
      const extractedParams = QueryIdentityCircuit.extractQueryProofParams(params)

      if (extractedParams && Object.keys(extractedParams).length > 0) {
        setModalParams(extractedParams)
        present()
      }
    })

    return () => subscription.remove()
  }, [present])

  return (
    <UiBottomSheet
      enableDynamicSizing
      ref={ref}
      footerComponent={() => (
        <View
          className='flex w-full flex-row gap-2'
          style={{ paddingBottom: insets.bottom + 1, paddingHorizontal: 10 }}
        >
          <UiButton
            title='Cancel'
            variant='outlined'
            className='flex-1'
            disabled={isGenerating}
            onPress={dismiss}
          />
          <UiButton
            title='Generate proof'
            className='flex-1'
            disabled={isGenerating}
            onPress={generateProof}
          />
        </View>
      )}
      headerComponent={
        <BottomSheetHeader title='Query proof params' className='mb-5 px-5' dismiss={dismiss} />
      }
      backgroundStyle={{ backgroundColor: palette.backgroundContainer }}
      snapPoints={['50%']}
    >
      <UiHorizontalDivider />
      <BottomSheetScrollView>
        <View style={{ padding: 16 }}>
          {params.length > 0 ? (
            params.map(({ title, value }) => (
              <View key={title} className='my-2 flex-row justify-between'>
                <Text>{title}</Text>
                <Text selectable className='flex-shrink text-right font-semibold'>
                  {Array.isArray(value) ? value.join(', ') : value}
                </Text>
              </View>
            ))
          ) : (
            <Text className='text-center'>No params</Text>
          )}
        </View>
      </BottomSheetScrollView>
    </UiBottomSheet>
  )
}
