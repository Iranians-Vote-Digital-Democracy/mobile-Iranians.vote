import { useNavigation } from '@react-navigation/native'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { bus, DefaultBusEvents, ErrorHandler } from '@/core'
import { AppStackScreenProps } from '@/route-types'
import { identityStore, walletStore } from '@/store'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import { UiButton, UiHorizontalDivider, UiScreenScrollable } from '@/ui'
import { EIDBasedQueryIdentityCircuit } from '@/utils/circuits/eid-based-query-identity-circuit'

export default function QueryProofScreen(props: AppStackScreenProps<'QueryProof'>) {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [isGenerating, setIsGenerating] = useState(false)
  const identities = identityStore.useIdentityStore(state => state.identities)
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  const generateProof = async () => {
    try {
      setIsGenerating(true)

      if (!identities.length) {
        throw new Error("Your identity hasn't registered yet!")
      }

      const currentIdentity = identities[identities.length - 1]
      if (!currentIdentity) throw new Error("Identity doesn't exist")
      if (!(currentIdentity instanceof NoirEIDIdentity))
        throw new Error('Identity is not NoirEIDIdentity')

      const circuitParams = new EIDBasedQueryIdentityCircuit(currentIdentity)

      const inputs = {
        skIdentity: `0x${privateKey}`,
      }

      await circuitParams.prove(inputs)
      bus.emit(DefaultBusEvents.success, {
        message: 'Proof generated successfully!',
      })
      cancel()
    } catch (error) {
      ErrorHandler.process(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const cancel = () => {
    if (!navigation.canGoBack()) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'App', params: { screen: 'Tabs' } }],
      })
      return
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'App', params: { screen: 'Tabs' } }],
    })
  }

  return (
    <View className='flex-1 bg-white'>
      <UiScreenScrollable
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
        }}
      >
        <Text className='text-2xl font-bold'>Query Proof params:</Text>
        <UiHorizontalDivider className='my-3' />

        <View className='my-2 flex-row items-center justify-between'>
          <Text>Proposal ID</Text>
          <Text selectable className='flex-shrink text-right font-bold'>
            {props.route.params?.proposalId}
          </Text>
        </View>
      </UiScreenScrollable>

      <View
        className='flex-row gap-2 px-4 pt-2'
        style={{
          paddingBottom: insets.bottom + 16,
          backgroundColor: 'white',
        }}
      >
        <UiButton
          title='Cancel'
          variant='outlined'
          className='flex-1'
          disabled={isGenerating}
          onPress={cancel}
        />
        <UiButton
          title='Generate proof'
          className='flex-1'
          disabled={isGenerating}
          onPress={generateProof}
        />
      </View>
    </View>
  )
}
