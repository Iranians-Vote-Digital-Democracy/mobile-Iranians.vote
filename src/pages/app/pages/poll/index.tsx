import { Time } from '@distributedlab/tools'
import { zodResolver } from '@hookform/resolvers/zod'
import { poseidon } from '@iden3/js-crypto'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { hexlify, JsonRpcProvider, toUtf8Bytes } from 'ethers'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Image, Pressable, Text, View } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z as zod } from 'zod'

import { apiClient, queryClient } from '@/api/client'
import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { Config } from '@/config'
import { bus, DefaultBusEvents } from '@/core'
import { createPoseidonSMTContract, createProposalContract, sleep } from '@/helpers'
import { formatDateDMY } from '@/helpers/formatters'
import { tryCatch } from '@/helpers/try-catch'
import { AppStackScreenProps } from '@/route-types'
import { identityStore, walletStore } from '@/store'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import {
  UiBottomSheet,
  UiButton,
  UiCard,
  UiHorizontalDivider,
  UiIcon,
  UiScreenScrollable,
  useUiBottomSheet,
} from '@/ui'
import { EIDBasedQueryIdentityCircuit } from '@/utils/circuits/eid-based-query-identity-circuit'
import { QueryProofParams } from '@/utils/circuits/types/QueryIdentity'

import PollStateScreen from './components/PollStateScreen'
import { ZERO_DATE_HEX } from './constants'
import { DecodedWhitelistData, ProposalMetadata } from './types'
import { parseProposalFromContract } from './utils'

enum Screen {
  Questions = 'questions',
  Submitting = 'submitting',
  Finish = 'finish',
}

const voteSchema = zod.object({
  votes: zod
    .array(
      zod
        .number()
        .nullable()
        .refine(v => v !== null, 'You must answer this question'),
    )
    .nonempty('At least one vote required'),
})

const rmoProvider = new JsonRpcProvider(RARIMO_CHAINS[Config.RMO_CHAIN_ID].rpcEvm)
const proposalContract = createProposalContract(Config.PROPOSAL_STATE_CONTRACT_ADDRESS, rmoProvider)

export default function PollScreen({ route }: AppStackScreenProps<'Poll'>) {
  const insets = useSafeAreaInsets()
  const bottomSheet = useUiBottomSheet()
  const navigation = useNavigation()

  const identities = identityStore.useIdentityStore(state => state.identities)
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [screen, setScreen] = useState<Screen>(Screen.Questions)

  const progress = useSharedValue(0)

  const startProgress = useCallback(() => {
    progress.value = withTiming(99, { duration: 5_000 })
  }, [progress])

  // Fetch proposal from contract
  const {
    data: parsedProposal,
    isLoading: isParsedProposalLoading,
    error: parsedProposalError,
  } = useQuery({
    queryKey: ['contractProposal', route.params?.proposalId],
    queryFn: async () => {
      if (!route.params?.proposalId) throw new Error('proposalId is not defined')

      const raw = await proposalContract.contractInstance.getProposalInfo(
        BigInt(route.params?.proposalId ?? 0),
      )
      return parseProposalFromContract(raw)
    },
    enabled: Boolean(route.params?.proposalId),
  })

  // Fetch proposal metadata from IPFS
  const {
    data: proposalMetadata,
    isLoading: isProposalMetadataLoading,
    error: proposalMetadataError,
  } = useQuery({
    queryKey: ['ipfsProposalMetadata', parsedProposal?.cid],
    queryFn: async () => {
      if (!parsedProposal) return null
      const result = await apiClient.get<ProposalMetadata>(
        `${Config.IPFS_NODE_URL}/${parsedProposal.cid}`,
      )
      return result.data
    },
    enabled: Boolean(parsedProposal),
  })

  const {
    data: isVoted,
    isLoading: isVotedLoading,
    error: isVotedError,
  } = useQuery({
    queryKey: ['isVoted', route.params?.proposalId],
    queryFn: async () => {
      const [isVoted] = await tryCatch(
        (async () => {
          if (!route.params?.proposalId) throw new Error('proposalId is not defined')
          const proposalId = route.params?.proposalId
          const privateKeyBigInt = BigInt(`0x${privateKey}`)
          const eventId = await proposalContract.contractInstance.getProposalEventId(proposalId)

          const pkHash = poseidon.hash([privateKeyBigInt])

          const nullifier = poseidon.hash([privateKeyBigInt, pkHash, eventId])
          const proposalInfo = await proposalContract.contractInstance.getProposalInfo(proposalId)
          const proposalSmtContractAddress = proposalInfo.proposalSMT
          const poseidonSmtContract = createPoseidonSMTContract(
            proposalSmtContractAddress,
            rmoProvider,
          )
          const proof = await poseidonSmtContract.contractInstance.getProof(
            '0x' + nullifier.toString(16).padStart(64, '0'),
          )
          return proof.existence
        })(),
      )
      return isVoted
    },
    enabled: Boolean(route.params?.proposalId),
  })

  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<zod.infer<typeof voteSchema>>({
    resolver: zodResolver(voteSchema),
    defaultValues: { votes: [] },
  })

  const votes = watch('votes')

  const submit = (vote: number) => {
    selectVote(currentQuestionIndex, vote)
    handleSubmit(generateProof)()
  }

  const goToNextQuestion = (vote: number) => {
    selectVote(currentQuestionIndex, vote)
    setCurrentQuestionIndex(prev => prev + 1)
  }

  const selectVote = (index: number, vote: number) => {
    setValue(`votes.${index}`, vote)
  }

  const generateProof = async ({ votes }: { votes: number[] }) => {
    progress.value = 0
    setScreen(Screen.Submitting)
    startProgress()
    try {
      if (!route.params?.proposalId) throw new Error('proposalId is not defined')
      if (!identities.length) throw new Error("Your identity hasn't registered yet!")
      const currentIdentity = identities[identities.length - 1]

      if (!currentIdentity) throw new Error("Identity doesn't exist")
      if (!(currentIdentity instanceof NoirEIDIdentity))
        throw new Error('Identity is not NoirEIDIdentity')

      const circuitParams = new EIDBasedQueryIdentityCircuit(
        currentIdentity,
        proposalContract.contractInstance,
      )
      const whitelistData = parsedProposal?.votingWhitelistData as DecodedWhitelistData

      const { timestamp, identityCounter } = await circuitParams.getPassportInfo()
      const { timestampUpper, identityCountUpper } = await circuitParams.getVotingBounds({
        whitelistData,
        timestamp,
        identityCounter,
      })

      const proposalId = route.params?.proposalId
      const eventId = await circuitParams.getEventId(proposalId)
      const eventData = circuitParams.getEventData(votes)

      const params: QueryProofParams = {
        eventId: String(eventId),
        eventData,
        identityCountUpper: String(identityCountUpper),
        timestampUpper: String(timestampUpper),
        selector: String(whitelistData.selector),
        expirationDateLower: String(whitelistData.expirationDateLowerBound),
        expirationDateUpper: ZERO_DATE_HEX,
        birthDateLower: String(whitelistData.birthDateLowerbound),
        birthDateUpper: String(whitelistData.birthDateUpperbound),
        skIdentity: `0x${privateKey}`,
        identityCounter: String(identityCounter),
        timestamp: String(timestamp),
        currentDate: hexlify(toUtf8Bytes(new Time().format('YYMMDD'))),
        identityCountLower: '0',
        citizenshipMask: '0',
        timestampLower: '0',
      }

      const proof = await circuitParams.prove(params)
      await circuitParams.submitVote({ proof, votes, proposalId })

      bus.emit(DefaultBusEvents.success, { message: 'Proof generated successfully!' })
      progress.value = withTiming(100, { duration: 100 })
      setScreen(Screen.Finish)
      reset()
      await sleep(5_000)
    } catch (error) {
      console.error('Proof generation failed:', error)
      progress.value = 0
      setScreen(Screen.Questions)
      bus.emit(DefaultBusEvents.error, { message: 'Proof generation failed. Please try again.' })
    }
  }

  // Initialize form votes array when metadata arrives
  useEffect(() => {
    if (proposalMetadata?.acceptedOptions?.length) {
      reset({ votes: Array(proposalMetadata.acceptedOptions.length).fill(null) })
    }
  }, [proposalMetadata?.acceptedOptions?.length, reset])

  const isLastQuestion = useMemo(
    () => currentQuestionIndex === (proposalMetadata?.acceptedOptions?.length ?? 0) - 1,
    [currentQuestionIndex, proposalMetadata?.acceptedOptions?.length],
  )

  const isLoading =
    isParsedProposalLoading ||
    isProposalMetadataLoading ||
    isVotedLoading ||
    !proposalMetadata ||
    !parsedProposal

  const isError =
    parsedProposalError || proposalMetadataError || !route.params?.proposalId || isVotedError

  if (isLoading) return <PollStateScreen.Loading />
  if (isError) return <PollStateScreen.Error />
  if (isVoted)
    return (
      <PollStateScreen.AlreadyVoted
        onGoBack={() => {
          navigation.navigate('App', { screen: 'Tabs' })
        }}
      />
    )

  // Screens map
  const screensMap: Record<Screen, ReactNode> = {
    [Screen.Questions]: (
      <QuestionScreen
        questions={proposalMetadata.acceptedOptions}
        currentQuestionIndex={currentQuestionIndex}
        currentVoteIndex={votes[currentQuestionIndex]}
        onSelectVote={vote => selectVote(currentQuestionIndex, vote)}
        onBack={() => setCurrentQuestionIndex(i => Math.max(i - 1, 0))}
        onClose={() => bottomSheet.dismiss()}
        onSubmit={isLastQuestion ? submit : goToNextQuestion}
      />
    ),
    [Screen.Submitting]: <PollStateScreen.Submitting animatedValue={progress} />,
    [Screen.Finish]: (
      <PollStateScreen.Finished
        onGoBack={() => {
          bottomSheet.dismiss()
          queryClient.invalidateQueries({
            queryKey: ['isVoted', route.params?.proposalId],
          })
          setScreen(Screen.Questions)
        }}
      />
    ),
  }

  return (
    <>
      <UiScreenScrollable style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className='flex-row p-4'>
          <View className='relative w-full gap-6 overflow-hidden rounded-3xl'>
            <UiCard className='flex-1 gap-4 p-6'>
              <View className='flex-col gap-2'>
                <Text className='typography-h6 text-textPrimary'>{proposalMetadata.title}</Text>
                <Text className='typography-body3 text-textSecondary'>
                  {proposalMetadata.description}
                </Text>
              </View>
              <View className='overflow-hidden rounded-md'>
                <Image
                  source={{ uri: `${Config.IPFS_NODE_URL}/${proposalMetadata?.imageCid}` }}
                  className='h-48 w-full'
                />
              </View>
              <View className='mt-6 flex-row items-center justify-between'>
                <View className='flex-row items-center gap-2'>
                  <UiIcon
                    customIcon='calendarBlankIcon'
                    size={20}
                    className='color-textSecondary'
                  />
                  <Text className='typography-subtitle5 text-textSecondary'>
                    {formatDateDMY(parsedProposal?.startTimestamp)}
                  </Text>
                </View>
              </View>

              <Pressable
                className='absolute right-[15px] top-[15px]'
                onPress={() => navigation.navigate('App', { screen: 'Tabs' })}
              >
                <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
                  <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
                </View>
              </Pressable>
            </UiCard>
          </View>
        </View>

        <UiHorizontalDivider className='my-5' />

        <View className='gap-3 px-6'>
          {[
            `Citizen of IRAN`,
            `After ${formatDateDMY(parsedProposal.startTimestamp)}`,
            `Before ${formatDateDMY(parsedProposal.startTimestamp + parsedProposal.duration)}`,
          ].map(title => (
            <View key={title} className='flex-row items-center gap-2'>
              <UiIcon customIcon='checkIcon' size={20} className='color-successMain' />
              <Text className='typography-subtitle4 text-textPrimary'>{title}</Text>
            </View>
          ))}
        </View>

        <View className='w-full flex-1 justify-end px-4 pb-4'>
          <UiButton title='Vote' onPress={bottomSheet.present} className='mt-8 w-full' />
        </View>
      </UiScreenScrollable>

      <UiBottomSheet
        ref={bottomSheet.ref}
        isCloseDisabled={isSubmitting}
        snapPoints={['100%']}
        headerComponent={<></>}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: 'backgroundContainer' }}
      >
        {screensMap[screen]}
      </UiBottomSheet>
    </>
  )
}

interface Question {
  title: string
  variants: string[]
}
interface QuestionScreenProps {
  questions: Question[]
  currentQuestionIndex: number
  currentVoteIndex: number | null
  onSelectVote: (id: number) => void
  onSubmit: (id: number) => void
  onBack: () => void
  onClose: () => void
}

function QuestionScreen({
  questions,
  currentVoteIndex,
  onSelectVote,
  currentQuestionIndex,
  onSubmit,
  onBack,
  onClose,
}: QuestionScreenProps) {
  const currentQuestion = questions[currentQuestionIndex]
  const isCanGoBack = currentQuestionIndex > 0
  const isLast = currentQuestionIndex === questions.length - 1
  const insets = useSafeAreaInsets()

  return (
    <View
      key={currentQuestionIndex}
      className='h-full gap-3 bg-backgroundPrimary p-4'
      style={{
        paddingBottom: insets.bottom,
      }}
    >
      <View className='flex-row items-center justify-between'>
        <Text className='typography-subtitle4 text-textSecondary'>
          Question: {currentQuestionIndex + 1}/{questions.length}
        </Text>
        <Pressable onPress={onClose}>
          <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
            <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
          </View>
        </Pressable>
      </View>

      <View className='flex-1 gap-3'>
        <UiCard className='w-full justify-center gap-5 p-4'>
          <Text className='typography-h6 text-center text-textPrimary'>
            {currentQuestion.title}
          </Text>
          <UiHorizontalDivider />
          <Text className='typography-overline2 text-textSecondary'>PICK YOUR ANSWER</Text>

          <View className='mt-3 gap-3'>
            {currentQuestion.variants.map((answer, index) => {
              const id = Number(index)
              const isSelected = currentVoteIndex === id

              return (
                <UiButton
                  key={`${answer}-${index}`}
                  color='primary'
                  variant='outlined'
                  size='medium'
                  onPress={() => onSelectVote(id)}
                >
                  <View className='relative w-full flex-row items-center justify-between'>
                    <Text
                      className='flex-1 truncate pr-6 text-sm text-textPrimary'
                      numberOfLines={1}
                      ellipsizeMode='tail'
                    >
                      {answer}
                    </Text>

                    {isSelected && (
                      <View className='absolute right-0'>
                        <UiIcon customIcon='checkIcon' size={20} className='color-successMain' />
                      </View>
                    )}
                  </View>
                </UiButton>
              )
            })}
          </View>
        </UiCard>
      </View>

      <>
        <UiHorizontalDivider />

        <View className='flex-row gap-3'>
          {isCanGoBack && (
            <UiButton
              variant='outlined'
              title='Previous'
              className='flex-1'
              leadingIconProps={{ customIcon: 'arrowLeftIcon' }}
              onPress={onBack}
            />
          )}

          <UiButton
            title={isLast ? 'Finish' : 'Next Question'}
            trailingIconProps={{ customIcon: 'arrowRightIcon' }}
            disabled={currentVoteIndex === null}
            className='flex-1'
            onPress={() => onSubmit(currentVoteIndex as number)}
          />
        </View>
      </>
    </View>
  )
}
