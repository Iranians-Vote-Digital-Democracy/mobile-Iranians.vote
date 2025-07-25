import { Time } from '@distributedlab/tools'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { hexlify, JsonRpcProvider, toUtf8Bytes } from 'ethers'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z as zod } from 'zod'

import { apiClient } from '@/api/client'
import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { Config } from '@/config'
import { bus, DefaultBusEvents } from '@/core'
import { createProposalContract, sleep } from '@/helpers'
import { formatDateDMY } from '@/helpers/formatters'
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

export default function PollScreen({ route }: AppStackScreenProps<'Polls'>) {
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

  if (parsedProposalError || proposalMetadataError || !route.params?.proposalId)
    return <ErrorScreen />
  if (isParsedProposalLoading || isProposalMetadataLoading || !proposalMetadata || !parsedProposal)
    return <LoadingScreen />

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
    [Screen.Submitting]: <SubmittingScreen animatedValue={progress} />,
    [Screen.Finish]: (
      <FinishScreen
        onGoBack={() => {
          bottomSheet.dismiss()
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

function SubmittingScreen({ animatedValue }: { animatedValue: SharedValue<number> }) {
  const barStyle = useAnimatedStyle(() => ({ width: `${animatedValue.value}%` }))
  const insets = useSafeAreaInsets()

  return (
    <View
      className='h-full justify-center gap-3 bg-backgroundPrimary p-4'
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className='w-full items-center gap-6'>
        <View className='mb-4 size-[80px] flex-row items-center justify-center rounded-full bg-warningLight'>
          <ActivityIndicator className='size-[40px] color-warningMain' />
        </View>
        <Text className='typography-h5 mb-2 text-textPrimary'>Please wait</Text>
        <Text className='typography-body3 mb-6 text-textSecondary'>Anonymizing your vote</Text>
        <View className='mb-4 h-2 w-4/5 rounded-full bg-componentPrimary'>
          <Animated.View className='h-full rounded-full bg-primaryMain' style={barStyle} />
        </View>
        <UiHorizontalDivider />
        <View className='w-full flex-row items-center rounded-lg bg-warningLight p-3'>
          <UiIcon customIcon='infoIcon' size={18} className='mr-2 color-warningMain' />
          <Text className='typography-body4 flex-1 text-warningMain'>
            Please don't close the app, or your answers won't be included.
          </Text>
        </View>
      </View>
    </View>
  )
}

function FinishScreen({ onGoBack }: { onGoBack: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className='h-full justify-center gap-3 bg-backgroundPrimary p-4'
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className='w-full flex-1 items-center justify-center gap-6 px-4'>
        <View className='mb-4 size-[80px] flex-row items-center justify-center rounded-full bg-successLight'>
          <UiIcon customIcon='checkIcon' size={40} className='color-successMain' />
        </View>
        <View className='items-center'>
          <Text className='typography-h5 mb-2 text-textPrimary'>Poll finished</Text>
          <Text className='typography-body3 mb-6 text-textSecondary'>
            Thanks for participation!
          </Text>
        </View>
        <View className='absolute inset-x-0 bottom-0 p-4'>
          <UiButton title='Go Back' onPress={onGoBack} className='w-full' />
        </View>
      </View>
    </View>
  )
}

const LoadingScreen = () => (
  <View className='h-full items-center justify-center bg-backgroundPrimary'>
    <ActivityIndicator size='large' color='#6366f1' />
    <Text className='typography-body3 mt-4 text-textSecondary'>Loading...</Text>
  </View>
)

const ErrorScreen = ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
  <View className='h-full items-center justify-center bg-backgroundPrimary px-6'>
    <UiIcon customIcon='warningIcon' size={48} className='mb-4 color-errorMain' />
    <Text className='typography-h6 mb-2 text-errorMain'>Something went wrong</Text>
    <Text className='typography-body3 mb-6 text-center text-textSecondary'>
      {message || 'Please try again later.'}
    </Text>
    {onRetry && <UiButton title='Try Again' onPress={onRetry} />}
  </View>
)
