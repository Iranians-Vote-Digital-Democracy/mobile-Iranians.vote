import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import {
  UiBottomSheet,
  UiButton,
  UiCard,
  UiHorizontalDivider,
  UiIcon,
  useUiBottomSheet,
} from '@/ui'

import PollSendScreen from './sendVoteContent'

interface Question {
  title: string
  variants: string[]
}

interface PollsVoteScreenProps {
  questions: Question[]
  currentQuestionIndex: number
  onVoteSubmit: (selectedAnswerId: string, questionIndex: number) => void
  onCloseBottomSheet: () => void
}

export default function PollsVoteScreen({
  questions,
  currentQuestionIndex,
  onVoteSubmit,
  onCloseBottomSheet,
}: PollsVoteScreenProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)

  const sendVotesBottomSheet = useUiBottomSheet()

  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const handleVote = () => {
    if (selectedAnswerId) {
      setHasVoted(true)

      if (isLastQuestion) {
        sendVotesBottomSheet.present()
      } else {
        onVoteSubmit(selectedAnswerId, currentQuestionIndex)
        setSelectedAnswerId(null)
        setHasVoted(false)
      }
    }
  }

  const handleClose = () => {
    onCloseBottomSheet()
  }

  return (
    <>
      <View className='h-full gap-3 bg-backgroundPrimary p-4'>
        <Header current={currentQuestionIndex} max={questions.length} onClose={handleClose} />

        <View style={{ flex: 1 }} className='gap-3'>
          <Body
            question={currentQuestion.title}
            answers={currentQuestion.variants}
            selectedAnswerId={selectedAnswerId}
            onSelectAnswer={setSelectedAnswerId}
            hasVoted={hasVoted}
          />
        </View>

        <Footer
          onPress={handleVote}
          selectedAnswerId={selectedAnswerId}
          hasVoted={hasVoted}
          isLastQuestion={isLastQuestion}
        />
      </View>
      <UiBottomSheet
        ref={sendVotesBottomSheet.ref}
        backgroundStyle={{
          backgroundColor: 'backgroundContainer',
        }}
        snapPoints={['100%']}
        enableDynamicSizing={false}
        detached={false}
        headerComponent={<></>}
      >
        <PollSendScreen />
      </UiBottomSheet>
    </>
  )
}

function Header({ current, max, onClose }: { current: number; max: number; onClose: () => void }) {
  return (
    <View className='flex-row items-center justify-between'>
      <Text className='typography-subtitle4 text-textSecondary'>
        Question: {current + 1}/{max}
      </Text>
      <Pressable onPress={onClose}>
        <View className='h-10 w-10 items-center justify-center rounded-full bg-componentPrimary'>
          <UiIcon customIcon='closeIcon' size={20} className='color-textPrimary' />
        </View>
      </Pressable>
    </View>
  )
}

function Body({
  question,
  answers,
  selectedAnswerId,
  onSelectAnswer,
  hasVoted,
}: {
  question: string
  answers: string[]
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
        {answers.map((answer, index) => (
          <AnswerButton
            key={answer + index}
            answer={answer}
            isSelected={selectedAnswerId === String(index)}
            onPress={() => onSelectAnswer(String(index))}
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
  answer: string
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
      <Text className='typography-subtitle4 text-center text-textPrimary'>{answer}</Text>
    </Pressable>
  )
}

interface FooterProps {
  onPress: () => void
  selectedAnswerId: string | null
  hasVoted: boolean
  isLastQuestion: boolean
}

function Footer({ onPress, selectedAnswerId, hasVoted, isLastQuestion }: FooterProps) {
  return (
    <>
      <UiHorizontalDivider className='' />
      <UiButton
        title={isLastQuestion ? 'Finish' : 'Next Question'}
        trailingIconProps={{
          customIcon: 'arrowRightIcon',
        }}
        onPress={onPress}
        disabled={!selectedAnswerId || (hasVoted && !isLastQuestion)}
      />
    </>
  )
}
