import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { AbiCoder, JsonRpcProvider } from 'ethers'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { apiClient } from '@/api/client'
import { RARIMO_CHAINS } from '@/api/modules/rarimo'
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
import SubmitVoteScreen, { ScreenKey, Step } from './components/SubmitVoteScreen'
import { MAX_UINT_32_HEX, ZERO_DATE_HEX } from './constants'
import { ProposalMetadata } from './types'
import { computeEventData, parseProposalFromContract } from './utils'

export default function PollScreen({ route }: AppStackScreenProps<'Polls'>) {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const bottomSheet = useUiBottomSheet()

  const identities = identityStore.useIdentityStore(state => state.identities)
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  const [answers, setAnswers] = useState<Map<number, string>>(new Map())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isCloseDisabled, setIsCloseDisabled] = useState(false)
  const [screenKey, setScreenKey] = useState<ScreenKey>('questions')
  const [step, setStep] = useState<Step>(Step.SendProof)
  const [progress, setProgress] = useState(0)

  const proposalId = route.params?.proposalId

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

      let identityCountUpper = BigInt(MAX_UINT_32_HEX)
      const ROOT_VALIDITY = await registrationPoseidonSMTContract.contractInstance.ROOT_VALIDITY()
      let timestampUpper = BigInt(whitelistData.identityCreationTimestampUpperBound) - ROOT_VALIDITY

      if (issueTimestamp > timestampUpper) {
        identityCountUpper = BigInt(whitelistData.identityCounterUpperBound)
        timestampUpper = issueTimestamp + 1n
        if (identityReissueCounter > whitelistData.identityCounterUpperBound) {
          throw new Error('Identity registered more than allowed, after voting start')
        }
      }

      const eventId = await proposalContract.contractInstance.getProposalEventId(proposalId!)
      const eventData = computeEventData([...answers.values()].map(Number))

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
        identityCountLower: '0',
        citizenshipMask: '0',
        timestampLower: '0',
      }

      const proof = await circuitParams.prove(inputs)

      // CALLDATA
      // ------------------------------------------------------------------------------------
      const registrationRoot = circuitParams.passportRegistrationProof?.root as string

      const abiCode = new AbiCoder()
      const userDataEncoded = abiCode.encode(
        ['uint256', 'uint256[]', 'tuple(uint256,uint256,uint256)'],
        [
          proposalId,
          [...answers.values()].map(v => 1 << Number(v)),
          ['0x' + proof.pub_signals[0], '0x' + proof.pub_signals[5], '0x' + proof.pub_signals[16]],
        ],
      )

      const callData = noirIdVotingContract.contractInterface.encodeFunctionData('executeNoir', [
        registrationRoot,
        '0x' + proof.pub_signals[14],
        userDataEncoded,
        '0x' + proof.proof,
      ])

      bus.emit(DefaultBusEvents.success, { message: 'Proof generated successfully!' })
      setProgress(100)
      setStep(Step.Finish)
      await sleep(5_000)
    } catch (error) {
      console.error('Proof generation failed:', error)
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

    setCurrentQuestionIndex(idx => idx + 1)
  }

  const goToPreviousQuestion = () => setCurrentQuestionIndex(idx => Math.max(idx - 1, 0))

  // Loading/Error
  if (parsedProposalError || proposalMetadataError || !proposalId) return <Text>Error</Text>
  if (isParsedProposalLoading || isProposalMetadataLoading || !proposalMetadata || !parsedProposal)
    return <Text>Loading...</Text>

  const totalQuestions = proposalMetadata?.acceptedOptions?.length ?? 0

  // Screens map
  const screensMap: Record<ScreenKey, JSX.Element> = {
    questions: (
      <QuestionScreen
        questions={proposalMetadata.acceptedOptions ?? []}
        currentQuestionIndex={currentQuestionIndex}
        onClose={() => bottomSheet.dismiss()}
        onBack={goToPreviousQuestion}
        onSubmit={saveAnswerAndNext}
      />
    ),
    submit: (
      <SubmitVoteScreen
        progress={progress}
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
      <UiScreenScrollable style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className='flex-row justify-end p-4'>
          <Pressable onPress={() => navigation.navigate('App', { screen: 'Tabs' })}>
            <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
              <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
            </View>
          </Pressable>
        </View>
        <UiCard className='m-4 rounded-3xl p-6'>
          <Text className='typography-h6 text-textPrimary'>{proposalMetadata.title}</Text>
          <Text className='typography-body3 mt-2 text-textSecondary'>
            {proposalMetadata.description}
          </Text>
          <View className='mt-4 flex-row items-center gap-2'>
            <UiIcon customIcon='calendarBlankIcon' size={20} className='color-textSecondary' />
            <Text className='typography-subtitle5 text-textSecondary'>
              {formatDateDMY(parsedProposal.startTimestamp)}
            </Text>
          </View>
        </UiCard>
        <UiHorizontalDivider />
        <View className='flex-1 justify-end p-4'>
          <UiButton title='Vote' onPress={bottomSheet.present} />
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
