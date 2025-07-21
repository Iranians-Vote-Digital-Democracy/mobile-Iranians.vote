import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { bus, DefaultBusEvents } from '@/core'
import { sleep } from '@/helpers'
import { identityStore, walletStore } from '@/store'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import { UiButton, UiHorizontalDivider, UiIcon } from '@/ui'
import { EIDBasedQueryIdentityCircuit } from '@/utils/circuits/eid-based-query-identity-circuit'
import { QueryProofParams } from '@/utils/circuits/types/QueryIdentity'

import { ParsedContractProposal } from '../types'

enum Step {
  SendProof,
  Finish,
}

interface SubmitVoteScreenProps {
  answers: Map<number, string>
  parsedProposal: ParsedContractProposal
  onStart: () => void
  onFinish: () => void
}

// TODO: Use `answers` somehow
export default function SubmitVoteScreen({
  // eslint-disable-next-line unused-imports/no-unused-vars
  answers,
  parsedProposal,
  onFinish,
  onStart,
}: SubmitVoteScreenProps) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>(Step.SendProof)
  const [progress, setProgress] = useState(0)
  const identities = identityStore.useIdentityStore(state => state.identities)
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  useEffect(() => {
    onStart()
    const generateProof = async () => {
      try {
        if (!identities.length) throw new Error("Your identity hasn't registered yet!")

        const currentIdentity = identities[identities.length - 1]
        if (!currentIdentity) throw new Error("Identity doesn't exist")
        if (!(currentIdentity instanceof NoirEIDIdentity))
          throw new Error('Identity is not NoirEIDIdentity')

        const circuitParams = new EIDBasedQueryIdentityCircuit(currentIdentity)
        const whitelistData = parsedProposal.votingWhitelistData

        const inputs: QueryProofParams = {
          selector: String(whitelistData.selector),
          // FIXME: Fails with identityCounterUpperBound from whitelistData
          // identityCounter: String(whitelistData.identityCounterUpperBound),
          skIdentity: `0x${privateKey}`,
        }

        await circuitParams.prove(inputs)
        // const proof = await circuitParams.prove(inputs)
        // console.log('proof', proof)

        bus.emit(DefaultBusEvents.success, {
          message: 'Proof generated successfully!',
        })

        setProgress(100)
        setStep(Step.Finish)
        await sleep(5_000)
        onFinish()
      } catch (error) {
        console.error('Proof generation failed:', error)
        bus.emit(DefaultBusEvents.error, {
          message: 'Proof generation failed. Please try again.',
        })
      }
    }

    generateProof()
  }, [identities, onFinish, onStart, parsedProposal, privateKey])

  return (
    <View
      className='h-full justify-center gap-3 bg-backgroundPrimary p-4'
      style={{
        paddingBottom: insets.bottom,
        paddingTop: insets.top,
      }}
    >
      {step === Step.SendProof ? <SendProofStep progress={progress} /> : <FinishStep />}
    </View>
  )
}

function SendProofStep({ progress }: { progress: number }) {
  return (
    <View className='w-full items-center gap-6'>
      <View className='mb-4 flex-row items-center justify-center rounded-full bg-warningLight'>
        <UiIcon customIcon='dotsThreeOutlineIcon' size={64} className='mb-4 color-warningMain' />
      </View>

      <Text className='typography-h5 mb-2 text-textPrimary'>Please wait</Text>
      <Text className='typography-body3 mb-6 text-textSecondary'>Anonymizing your vote</Text>

      <View className='mb-4 h-2 w-4/5 rounded-full bg-componentPrimary'>
        <View className='h-full rounded-full bg-primaryMain' style={{ width: `${progress}%` }} />
      </View>

      <Text className='typography-caption2 mb-8 text-primaryMain'>{progress.toFixed(0)}%</Text>

      <UiHorizontalDivider />

      <View className='w-full flex-row items-center rounded-lg bg-warningLight p-3'>
        <UiIcon customIcon='infoIcon' size={18} className='mr-2 color-warningMain' />
        <Text className='typography-body4 flex-1 text-warningMain'>
          Please don't close the app, or your answers won't be included.
        </Text>
      </View>
    </View>
  )
}

function FinishStep() {
  return (
    <View className='w-full items-center gap-6'>
      <View className='mb-4 flex-row items-center justify-center rounded-full bg-successLight'>
        <UiIcon customIcon='checkIcon' size={64} className='mb-4 color-successMain' />
      </View>

      <Text className='typography-h5 mb-2 text-textPrimary'>Poll finished</Text>
      <Text className='typography-body3 mb-6 text-textSecondary'>Thanks for participation!</Text>

      <UiHorizontalDivider />

      <View className='absolute bottom-0 mb-4 w-full px-4'>
        <UiButton title='Go Back' onPress={() => {}} className='w-full' />
      </View>
    </View>
  )
}
