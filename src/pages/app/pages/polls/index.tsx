import { Time } from '@distributedlab/tools'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { AbiCoder, hexlify, JsonRpcProvider, toUtf8Bytes } from 'ethers'
import { ReactNode, useMemo, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { apiClient } from '@/api/client'
import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { relayerVerification } from '@/api/modules/verification/relayer'
import { Config } from '@/config'
import { bus, DefaultBusEvents } from '@/core'
import {
  createNoirIdVotingContract,
  createPoseidonSMTContract,
  createProposalContract,
  sleep,
} from '@/helpers'
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

import QuestionScreen from './components/QuestionScreen'
import SubmitVoteScreen, { Step } from './components/SubmitVoteScreen'
import { MAX_UINT_32_HEX, ZERO_DATE_HEX } from './constants'
import { ProposalMetadata } from './types'
import { computeEventData, parseProposalFromContract } from './utils'

export enum SendProofStep {
  SendProof,
  Finish,
}

type ScreenKey = 'questions' | 'submit'

export default function PollScreen({ route }: AppStackScreenProps<'Polls'>) {
  const insets = useSafeAreaInsets()
  const bottomSheet = useUiBottomSheet()

  const identities = identityStore.useIdentityStore(state => state.identities)
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  const [answers, setAnswers] = useState<Map<number, string>>(new Map())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isCloseDisabled, setIsCloseDisabled] = useState(false)
  const [screenKey, setScreenKey] = useState<ScreenKey>('questions')
  const [step, setStep] = useState<Step>(Step.SendProof)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)

  const progress = useSharedValue(0)

  const proposalId = route.params?.proposalId

  const startProgress = () => {
    progress.value = withTiming(99, { duration: 5_000 })
  }

  const rmoProvider = useMemo(
    () => new JsonRpcProvider(RARIMO_CHAINS[Config.RMO_CHAIN_ID].rpcEvm),
    [],
  )

  // Contracts
  const proposalContract = useMemo(
    () => createProposalContract(Config.PROPOSAL_STATE_CONTRACT_ADDRESS, rmoProvider),
    [rmoProvider],
  )

  const noirIdVotingContract = useMemo(
    () => createNoirIdVotingContract(Config.NOIR_ID_VOTING_CONTRACT, rmoProvider),
    [rmoProvider],
  )

  const registrationPoseidonSMTContract = useMemo(
    () => createPoseidonSMTContract(Config.REGISTRATION_POSEIDON_SMT_CONTRACT_ADDRESS, rmoProvider),
    [rmoProvider],
  )

  // Fetch proposal from contract
  const {
    data: parsedProposal,
    isLoading: isParsedProposalLoading,
    error: parsedProposalError,
  } = useQuery({
    queryKey: ['contractProposal', proposalId],
    queryFn: async () => {
      if (!proposalId) return null
      const raw = await proposalContract.contractInstance.getProposalInfo(BigInt(proposalId))
      return parseProposalFromContract(raw)
    },
    enabled: Boolean(proposalId),
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
        `${Config.IPFS_NODE_URL}${parsedProposal.cid}`,
      )
      return result.data
    },
    enabled: Boolean(parsedProposal),
  })

  const generateProof = async (_answers: Map<number, string>) => {
    setIsCloseDisabled(true)
    startProgress()
    try {
      if (!identities.length) throw new Error("Your identity hasn't registered yet!")
      const currentIdentity = identities[identities.length - 1]

      if (!currentIdentity) throw new Error("Identity doesn't exist")

      if (!(currentIdentity instanceof NoirEIDIdentity))
        throw new Error('Identity is not NoirEIDIdentity')

      const circuitParams = new EIDBasedQueryIdentityCircuit(currentIdentity)
      const whitelistData = parsedProposal!.votingWhitelistData

      const [passportInfo_, identityInfo_] = await currentIdentity.getPassportInfo()
      const identityReissueCounter = passportInfo_.identityReissueCounter
      const issueTimestamp = identityInfo_.issueTimestamp

      const ROOT_VALIDITY = BigInt(
        await registrationPoseidonSMTContract.contractInstance.ROOT_VALIDITY(),
      )
      let timestampUpper = BigInt(whitelistData.identityCreationTimestampUpperBound) - ROOT_VALIDITY
      let identityCountUpper = BigInt(MAX_UINT_32_HEX)

      if (issueTimestamp > 0n) {
        timestampUpper = issueTimestamp

        identityCountUpper = BigInt(whitelistData.identityCounterUpperBound)

        if (identityReissueCounter > BigInt(whitelistData.identityCounterUpperBound)) {
          throw new Error('Identity registered more than allowed, after voting start')
        }
      }

      const eventId = await proposalContract.contractInstance.getProposalEventId(proposalId!)
      const eventData = computeEventData([..._answers.values()].map(Number))

      const inputs: QueryProofParams = {
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
        identityCounter: String(identityReissueCounter),
        timestamp: String(issueTimestamp),
        currentDate: hexlify(toUtf8Bytes(new Time().format('YYMMDD'))),
        identityCountLower: '0',
        citizenshipMask: '0',
        timestampLower: '0',
      }

      const proof = await circuitParams.prove(inputs)

      // CALLDATA
      // ------------------------------------------------------------------------------------
      const abiCode = new AbiCoder()
      const userDataEncoded = abiCode.encode(
        ['uint256', 'uint256[]', 'tuple(uint256,uint256,uint256)'],
        [
          proposalId,
          // votes mask
          Array.from(_answers.values()).map(v => 1 << Number(v)),
          // User payload: (nullifier, citizenship, timestampUpperbound)
          ['0x' + proof.pub_signals[0], '0x' + proof.pub_signals[6], '0x' + proof.pub_signals[15]],
        ],
      )

      const callDataHex = noirIdVotingContract.contractInterface.encodeFunctionData('executeNoir', [
        circuitParams.passportRegistrationProof?.root as string,
        '0x' + proof.pub_signals[13],
        userDataEncoded,
        '0x' + proof.proof,
      ])

      await relayerVerification(callDataHex, Config.NOIR_ID_VOTING_CONTRACT)

      bus.emit(DefaultBusEvents.success, { message: 'Proof generated successfully!' })
      progress.value = withTiming(100, { duration: 100 })
      setStep(Step.Finish)
      await sleep(5_000)
    } catch (error) {
      console.error('Proof generation failed:', error)
      progress.value = 0
      bus.emit(DefaultBusEvents.error, { message: 'Proof generation failed. Please try again.' })
    } finally {
      setIsCloseDisabled(false)
    }
  }

  // Handlers
  const saveAnswerAndNext = (selectedAnswerId: string) => {
    const newAnswers = new Map(answers)
    newAnswers.set(currentQuestionIndex, selectedAnswerId)
    setAnswers(newAnswers)

    if (currentQuestionIndex === totalQuestions - 1) {
      setScreenKey('submit')
      generateProof(newAnswers)
      return
    }

    setSelectedAnswerId(null)
    setCurrentQuestionIndex(idx => idx + 1)
  }

  const goToPreviousQuestion = () => setCurrentQuestionIndex(idx => Math.max(idx - 1, 0))

  // Loading/Error
  if (parsedProposalError || proposalMetadataError || !proposalId) return <Text>Error</Text>
  if (isParsedProposalLoading || isProposalMetadataLoading || !proposalMetadata || !parsedProposal)
    return <Text>Loading...</Text>

  const totalQuestions = proposalMetadata?.acceptedOptions?.length ?? 0

  // Screens map
  const screensMap: Record<ScreenKey, ReactNode> = {
    questions: (
      <QuestionScreen
        questions={proposalMetadata.acceptedOptions ?? []}
        currentQuestionIndex={currentQuestionIndex}
        selectedAnswerId={selectedAnswerId}
        onBack={goToPreviousQuestion}
        onClose={() => bottomSheet.dismiss()}
        onSelectAnswer={setSelectedAnswerId}
        onSubmit={saveAnswerAndNext}
      />
    ),
    submit: (
      <SubmitVoteScreen
        animatedValue={progress}
        step={step}
        onGoBack={() => {
          bottomSheet.dismiss()
          setScreenKey('questions')
        }}
      />
    ),
  }

  return (
    <>
      <UiScreenScrollable
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View className='flex-row p-4'>
          <PollsHeader
            title={proposalMetadata.title}
            subtitle={proposalMetadata.description}
            date={formatDateDMY(parsedProposal?.startTimestamp)}
            image={`${Config.IPFS_NODE_URL}${proposalMetadata?.imageCid}`}
          />
        </View>

        <UiHorizontalDivider className='my-5' />

        <View className='gap-3 px-6'>
          <CriteriaRow title='Citizen of IRAN' status='approved' />
          <CriteriaRow
            title={`After ${formatDateDMY(parsedProposal.startTimestamp)}`}
            status='approved'
          />
          <CriteriaRow
            title={`Before ${formatDateDMY(parsedProposal.startTimestamp + parsedProposal.duration)}`}
            status='approved'
          />
        </View>

        <View className='w-full flex-1 justify-end px-4 pb-4'>
          <UiButton title='Vote' onPress={bottomSheet.present} className='mt-8 w-full' />
        </View>
      </UiScreenScrollable>

      <UiBottomSheet
        ref={bottomSheet.ref}
        isCloseDisabled={isCloseDisabled}
        snapPoints={['100%']}
        headerComponent={<></>}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: 'backgroundContainer' }}
      >
        {screensMap[screenKey]}
      </UiBottomSheet>
    </>
  )
}

export type CriteriaStatus = 'approved' | 'needVerification' | 'notVerified'

const statusMeta = {
  approved: {
    icon: <UiIcon customIcon='checkIcon' size={20} className='color-successMain' />,
    textColor: 'text-textPrimary',
  },
  needVerification: {
    icon: <UiIcon customIcon='questionIcon' size={20} className='color-warningMain' />,
    textColor: 'text-textPrimary',
  },
  notVerified: {
    icon: <UiIcon customIcon='closeIcon' size={20} className='color-errorMain' />,
    textColor: 'text-errorMain',
  },
}

const CriteriaRow = ({ title, status }: { title: string; status: CriteriaStatus }) => {
  const { icon, textColor } = statusMeta[status]
  return (
    <View className='flex-row items-center gap-2'>
      {icon}
      <Text className={`typography-subtitle4 ${textColor}`}>{title}</Text>
    </View>
  )
}

const PollsHeader = ({
  title,
  subtitle,
  date,
  image,
}: {
  title: string
  subtitle: string
  date: string
  image: string
}) => {
  const navigation = useNavigation()
  return (
    <View className='relative w-full gap-6 overflow-hidden rounded-3xl'>
      <UiCard className='flex-1 gap-4 p-6'>
        <View className='flex-col gap-2'>
          <Text className='typography-h6 text-textPrimary'>{title}</Text>
          <Text className='typography-body3 text-textSecondary'>{subtitle}</Text>
        </View>
        <View>
          <Image source={{ uri: image }} className='h-48 w-full' />
        </View>
        <View className='mt-6 flex-row items-center justify-between'>
          <View className='flex-row items-center gap-2'>
            <UiIcon customIcon='calendarBlankIcon' size={20} className='color-textSecondary' />
            <Text className='typography-subtitle5 text-textSecondary'>{date}</Text>
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
  )
}
