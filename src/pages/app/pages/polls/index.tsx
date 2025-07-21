import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { JsonRpcProvider } from 'ethers'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { apiClient } from '@/api/client'
import { RARIMO_L2_CHAINS } from '@/api/modules/rarimo'
import { Config } from '@/config'
import { formatDateDMY } from '@/helpers/formatters'
import { AppStackScreenProps } from '@/route-types'
import { useAppPaddings } from '@/theme/utils'
import { ProposalState__factory } from '@/types/contracts'
import {
  UiBottomSheet,
  UiButton,
  UiCard,
  UiHorizontalDivider,
  UiIcon,
  UiScreenScrollable,
  useUiBottomSheet,
} from '@/ui'

import QuestionScreen from './components/QuestionScreen'
import SendVoteScreen from './components/SubmitVoteScreen'
import { parseProposalFromContract } from './utils'

export default function PollScreen({ route }: AppStackScreenProps<'Polls'>) {
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()
  const bottomSheet = useUiBottomSheet()
  const navigation = useNavigation()
  const [answers, setAnswers] = useState<Map<number, string>>(new Map())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isCloseDisabled, setIsCloseDisabled] = useState(false)

  const contract = useMemo(() => {
    const provider = new JsonRpcProvider(RARIMO_L2_CHAINS[Config.RMO_L2_CHAIN_ID].rpcEvm)
    return ProposalState__factory.connect(Config.PROPOSAL_STATE_CONTRACT_ADDRESS, provider)
  }, [])

  const {
    data: parsedProposal,
    isLoading: isParsedProposalLoading,
    error: parsedProposalError,
  } = useQuery({
    queryKey: ['contractProposal'],
    queryFn: async () => {
      if (!route.params?.proposalId) return null
      const raw = await contract.getProposalInfo(BigInt(route.params.proposalId))
      return parseProposalFromContract(raw)
    },
    enabled: Boolean(route.params?.proposalId),
  })

  const {
    data: proposalMetadata,
    isLoading: isProposalMetadataLoading,
    error: proposalMetadataError,
  } = useQuery({
    queryKey: ['ipfsProposalMetadata'],
    queryFn: async () => {
      return apiClient.get(`${Config.IPFS_NODE_URL}${parsedProposal?.cid}`)
    },
    enabled: Boolean(parsedProposal),
  })

  const questions = proposalMetadata?.data.acceptedOptions ?? []
  const totalQuestions = questions.length
  const hasAnsweredAll = answers.size === totalQuestions

  const saveAnswerAndNext = (selectedAnswerId: string) => {
    setAnswers(prev => {
      const updated = new Map(prev)
      updated.set(currentQuestionIndex, selectedAnswerId)
      return updated
    })

    setCurrentQuestionIndex(prev => prev + 1)
  }

  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex(prev => Math.max(prev - 1, 0))
  }

  if (proposalMetadataError || parsedProposalError) return <Text>Error</Text>
  if (isProposalMetadataLoading || !proposalMetadata || isParsedProposalLoading || !parsedProposal)
    return <Text>Loading...</Text>

  return (
    <>
      <UiScreenScrollable
        style={{
          paddingTop: insets.top,
          paddingLeft: appPaddings.left,
          paddingRight: appPaddings.right,
          paddingBottom: insets.bottom,
        }}
        className='gap-3'
      >
        <View className='flex flex-col gap-4'>
          <Pressable
            onPress={() => {
              navigation.navigate('App', {
                screen: 'Tabs',
              })
            }}
          >
            <View className='h-10 w-10 items-center justify-center self-end rounded-full bg-componentPrimary'>
              <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
            </View>
          </Pressable>
          <PollsHeader
            title={proposalMetadata.data.title}
            subtitle={proposalMetadata.data.description}
            date={formatDateDMY(parsedProposal?.startTimestamp)}
          />
        </View>

        <UiHorizontalDivider className='my-5' />

        {/* TODO: Implement criterias */}
        <View className='gap-3'>
          <CriteriaRow title='Test criteria 1' status='approved' />
          <CriteriaRow title='Test criteria 2' status='approved' />
          <CriteriaRow title='Test criteria 3' status='approved' />
        </View>

        <View className='w-full flex-1 justify-end'>
          <UiButton title='Vote' onPress={bottomSheet.present} className='mt-8 w-full' />
        </View>
      </UiScreenScrollable>

      <UiBottomSheet
        ref={bottomSheet.ref}
        isCloseDisabled={isCloseDisabled}
        snapPoints={['100%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: 'backgroundContainer' }}
        headerComponent={<></>}
      >
        {hasAnsweredAll ? (
          <SendVoteScreen
            answers={answers}
            parsedProposal={parsedProposal}
            onStart={() => setIsCloseDisabled(true)}
            onFinish={() => setIsCloseDisabled(false)}
          />
        ) : (
          <QuestionScreen
            questions={questions}
            currentQuestionIndex={currentQuestionIndex}
            onClose={() => bottomSheet.dismiss()}
            onSubmit={saveAnswerAndNext}
            onBack={goToPreviousQuestion}
          />
        )}
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
}: {
  title: string
  subtitle: string
  date: string
}) => (
  <View className='gap-6 overflow-hidden rounded-3xl'>
    <UiCard className='p-6'>
      <View className='flex-col gap-2'>
        <Text className='typography-h6 text-textPrimary'>{title}</Text>
        <Text className='typography-body3 text-textSecondary'>{subtitle}</Text>
      </View>
      <View className='mt-6 flex-row items-center justify-between'>
        <View className='flex-row items-center gap-2'>
          <UiIcon customIcon='calendarBlankIcon' size={20} className='color-textSecondary' />
          <Text className='typography-subtitle5 text-textSecondary'>{date}</Text>
        </View>
      </View>
    </UiCard>
  </View>
)
