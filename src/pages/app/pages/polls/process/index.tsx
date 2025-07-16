import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppPaddings, useBottomBarOffset } from '@/theme'
import { UiButton, UiCard, UiHorizontalDivider, UiIcon, UiScreenScrollable } from '@/ui'

// Mock data for preview
const mockQuestion = 'What makes a good manager?'
const mockAnswers = [
  { id: '1', text: 'Clear communication', votes: 0 },
  { id: '2', text: 'Delegation skills', votes: 0 },
  { id: '3', text: 'Empathy and understanding', votes: 0 },
  { id: '4', text: 'Decision-making abilities', votes: 0 },
]

export default function PollsVoteScreen() {
  const insets = useSafeAreaInsets()
  const appPaddings = useAppPaddings()
  const offset = useBottomBarOffset()

  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)

  const handleVote = () => {
    if (selectedAnswerId) {
      setHasVoted(true)
    }
  }

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingLeft: appPaddings.left,
        paddingRight: appPaddings.right,
        paddingBottom: offset,
      }}
      className='gap-3'
    >
      <View>
        <Header />
      </View>
      <UiScreenScrollable
        style={{
          flex: 1,
        }}
        className='gap-3'
      >
        <Body
          question={mockQuestion}
          answers={mockAnswers}
          selectedAnswerId={selectedAnswerId}
          onSelectAnswer={setSelectedAnswerId}
          hasVoted={hasVoted}
        />
      </UiScreenScrollable>

      <View>
        <Footer onPress={handleVote} selectedAnswerId={selectedAnswerId} hasVoted={hasVoted} />
      </View>
    </View>
  )
}

function Header() {
  const currentQuestion = 0 // mock for now
  const maxQuestion = 5 // TODO: Change for props
  return (
    <View className='flex-row items-center justify-between'>
      <Text className='typography-subtitle4 text-textSecondary'>
        Question: {currentQuestion + 1}/{maxQuestion}
      </Text>
      <Pressable onPress={() => {}}>
        <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
          <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
        </View>
      </Pressable>
    </View>
  )
}

interface AnswerOption {
  id: string
  text: string
  votes?: number
}

function Body({
  question,
  answers,
  selectedAnswerId,
  onSelectAnswer,
  hasVoted,
}: {
  question: string
  answers: AnswerOption[]
  selectedAnswerId: string | null
  onSelectAnswer: (id: string) => void
  hasVoted: boolean
}) {
  return (
    <UiCard className='w-full justify-center gap-5'>
      <Text className='typography-h6 text-center text-textPrimary'>{question}</Text>
      <UiHorizontalDivider />
      <Text className='typography-overline2 text-textSecondary'>PICK YOUR ANSWER</Text>

      <View className='gap-3'>
        {answers.map(answer => (
          <AnswerButton
            key={answer.id}
            answer={answer}
            isSelected={selectedAnswerId === answer.id}
            onPress={() => onSelectAnswer(answer.id)}
            hasVoted={hasVoted}
          />
        ))}
      </View>
    </UiCard>
  )
}

function AnswerButton({
  answer,
  isSelected,
  onPress,
  hasVoted,
}: {
  answer: AnswerOption
  isSelected: boolean
  onPress: () => void
  hasVoted: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={hasVoted}
      className={
        'rounded-lg border px-5 py-4 ' +
        (isSelected ? 'border-textPrimary bg-componentPrimary' : 'border-componentPrimary')
      }
    >
      <Text className='typography-subtitle4 text-center text-textPrimary'>{answer.text}</Text>
    </Pressable>
  )
}

interface FooterProps {
  onPress: () => void
  selectedAnswerId: string | null
  hasVoted: boolean
}

function Footer({ onPress, selectedAnswerId, hasVoted }: FooterProps) {
  return (
    <View className='w-full flex-row'>
      <UiButton
        title={hasVoted ? 'Next Question' : 'Vote'}
        trailingIconProps={{
          customIcon: hasVoted ? 'arrowRightIcon' : 'arrowRightIcon', //Change icon but to what
        }}
        onPress={onPress}
        disabled={!selectedAnswerId || hasVoted}
      />
    </View>
  )
}
