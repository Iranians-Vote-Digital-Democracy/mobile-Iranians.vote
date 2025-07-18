import { useState } from 'react'
import { Text, View } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppPaddings, useBottomBarOffset } from '@/theme/utils'
import {
  UiBottomSheet,
  UiButton,
  UiCard,
  UiHorizontalDivider,
  UiIcon,
  UiScreenScrollable,
  useUiBottomSheet,
} from '@/ui'

import PollsVoteScreen from './components/votingContent'
const mockQuestions = [
  {
    question: 'What is your favorite language?',
    answers: [
      { id: '1', text: 'Rust' },
      { id: '2', text: 'Go' },
      { id: '3', text: 'TypeScript' },
      { id: '4', text: 'Python' },
    ],
  },
  {
    question: 'Which mobile platform do you prefer?',
    answers: [
      { id: '5', text: 'React Native' },
      { id: '6', text: 'Flutter' },
      { id: '7', text: 'SwiftUI' },
      { id: '8', text: 'Jetpack Compose' },
    ],
  },
]
export enum Steps {
  NeedVerification,

  Verified,

  NotVerified,

  AlredyVote,
}

export default function PollsScreen() {
  // {}: AppTabScreenProps<'Polls'>
  const insets = useSafeAreaInsets()

  const appPaddings = useAppPaddings()

  const offset = useBottomBarOffset()

  return (
    <UiScreenScrollable
      style={{
        paddingTop: insets.top,

        paddingLeft: appPaddings.left,

        paddingRight: appPaddings.right,

        paddingBottom: offset,
      }}
      className='gap-3'
    >
      <View className='flex flex-row gap-4'>
        <View className='flex-1' />

        <Pressable onPress={() => {}}>
          <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
            <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
          </View>
        </Pressable>

        <PollsHeader title='Test polls' subtitle='this is test polls!!!' date='15 Jul' />
      </View>

      <UiHorizontalDivider />

      <View className='flex-1 p-4'>
        <PollsContent />
      </View>
    </UiScreenScrollable>
  )
}

function PollsHeader({
  title,

  subtitle,

  date,
}: {
  title: string

  subtitle: string

  date: string
}) {
  return (
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
}

function PollsContent() {
  const [currentStep] = useState<Steps>(Steps.NeedVerification)
  const votingBottomSheet = useUiBottomSheet()

  switch (currentStep) {
    case Steps.NeedVerification:
      return (
        <View className='flex-1'>
          <Text className='typography-overline2 mb-6 text-textSecondary'>CRITERIA</Text>

          <UiCard className='mb-8 flex-row items-center justify-between rounded-lg p-3'>
            <Text className='typography-body3 text-textSecondary'>Your status:</Text>

            <View className='flex-row items-center gap-2 bg-warningLight'>
              <Text className='typography-buttonMedium text-warningMain'>NEED VERIFICATION</Text>
            </View>
          </UiCard>

          <View className='mb-auto flex-col gap-4'>
            <CriteriaRow title='test' status='needVerification' />

            <CriteriaRow title='anonymous' status='needVerification' />
          </View>

          <UiButton
            title='verify your identity'
            trailingIconProps={{ customIcon: 'userIcon' }}
            onPress={() => {}} //TODO: navigate to scan document screen
            className='mt-8 w-full'
          />
        </View>
      )

    case Steps.Verified:
      return (
        <View className='flex-1'>
          <Text className='typography-overline2 mb-6 text-textSecondary'>CRITERIA</Text>

          <UiCard className='mb-8 flex-row items-center justify-between rounded-lg p-3'>
            <Text className='typography-body3 text-textSecondary'>Your status:</Text>

            <View className='flex-row items-center gap-2 bg-successLight'>
              <Text className='typography-buttonMedium text-successMain'>VERIFIED</Text>
            </View>
          </UiCard>

          <View className='mb-auto flex-col gap-4'>
            <CriteriaRow title='test' status='approved' />

            <CriteriaRow title='anonymous' status='approved' />
          </View>

          <UiButton
            title='Vote'
            trailingIconProps={{ customIcon: 'userIcon' }}
            onPress={votingBottomSheet.present}
            className='mt-8 w-full'
          />
          <UiBottomSheet
            ref={votingBottomSheet.ref}
            backgroundStyle={{
              backgroundColor: 'backgroundContainer',
            }}
            enableDynamicSizing={true}
          >
            <PollsVoteScreen
              questions={mockQuestions}
              currentQuestionIndex={1}
              onVoteSubmit={() => {}}
            />
          </UiBottomSheet>
        </View>
      )

    case Steps.NotVerified:
      return (
        <View className='flex-1'>
          <Text className='typography-overline2 mb-6 text-textSecondary'>CRITERIA</Text>

          <UiCard className='mb-8 flex-row items-center justify-between rounded-lg p-3'>
            <Text className='typography-body3 text-textSecondary'>Your status:</Text>

            <View className='flex-row items-center gap-2 bg-errorLight'>
              <Text className='typography-buttonMedium text-errorMain'>NOT VERIFIED</Text>
            </View>
          </UiCard>

          <View className='mb-auto flex-col gap-4'>
            <CriteriaRow title='test' status='notVerified' />

            <CriteriaRow title='anonymous' status='notVerified' />
          </View>

          <Text className='typography-h4 text-errorMain'>
            Based on the criteria, you do not meet the requirements for participation
          </Text>

          <UiButton
            title='Back Home'
            onPress={() => {}} //TODO: Navigate to home screen
            className='mt-8 w-full'
          />
        </View>
      )

    case Steps.AlredyVote:
      return (
        <View className='flex-1'>
          <Text className='typography-overline2 mb-6 text-textSecondary'>CRITERIA</Text>

          <UiCard className='mb-8 flex-row items-center justify-between rounded-lg p-3'>
            <Text className='typography-body3 text-textSecondary'>Your status:</Text>

            <View className='flex-row items-center gap-2 bg-successLight'>
              <Text className='typography-buttonMedium text-successMain'>VOTED</Text>
            </View>
          </UiCard>

          <UiButton
            title='You have already voted'
            onPress={() => {}}
            className='mt-8 w-full'
            disabled={true}
          />
        </View>
      )
  }
}

export type CriteriaStatus = 'approved' | 'needVerification' | 'notVerified'

function CriteriaRow({ title, status }: { title: string; status: CriteriaStatus }) {
  switch (status) {
    case 'approved':
      return (
        <View className='flex-row items-center gap-2'>
          <UiIcon customIcon='checkIcon' size={20} className='color-successMain' />

          <Text className='typography-subtitle4 text-textPrimary'>{title}</Text>
        </View>
      )

    case 'needVerification':
      return (
        <View className='flex-row items-center gap-2'>
          <UiIcon customIcon='questionIcon' size={20} className='color-warningMain' />

          <Text className='typography-subtitle4 text-textPrimary'>{title}</Text>
        </View>
      )

    case 'notVerified':
      return (
        <View className='flex-row items-center gap-2'>
          <UiIcon customIcon='closeIcon' size={20} className='color-errorMain' />
          <Text className='typography-subtitle4 text-errorMain'>{title}</Text>
        </View>
      )
  }
}
