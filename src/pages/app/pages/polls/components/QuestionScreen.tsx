import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { cn } from '@/theme/utils'
import { UiButton, UiCard, UiHorizontalDivider, UiIcon } from '@/ui'

interface Question {
  title: string
  variants: string[]
}

interface QuestionScreenProps {
  questions: Question[]
  currentQuestionIndex: number
  onClose: () => void
  onBack: () => void
  onSubmit: (selectedAnswerId: string) => void
}

export default function QuestionScreen({
  questions,
  currentQuestionIndex,
  onSubmit,
  onBack,
  onClose,
}: QuestionScreenProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const insets = useSafeAreaInsets()

  const canGoBack = currentQuestionIndex > 0

  return (
    <View
      className='h-full gap-3 bg-backgroundPrimary p-4'
      style={{
        paddingBottom: insets.bottom,
      }}
    >
      <Header current={currentQuestionIndex} max={questions.length} onClose={onClose} />

      <View className='flex-1 gap-3'>
        <QuestionCard
          question={currentQuestion.title}
          answers={currentQuestion.variants}
          selectedAnswerId={selectedAnswerId}
          onSelectAnswer={setSelectedAnswerId}
        />
      </View>

      <Footer
        selectedAnswerId={selectedAnswerId}
        isLastQuestion={isLastQuestion}
        canGoBack={canGoBack}
        onBack={onBack}
        onPress={() => onSubmit(selectedAnswerId!)}
      />
    </View>
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

function QuestionCard({
  question,
  answers,
  selectedAnswerId,
  onSelectAnswer,
}: {
  question: string
  answers: string[]
  selectedAnswerId: string | null
  onSelectAnswer: (id: string) => void
}) {
  return (
    <UiCard className='w-full justify-center gap-5'>
      <Text className='typography-h6 text-center text-textPrimary'>{question}</Text>
      <UiHorizontalDivider />
      <Text className='typography-overline2 text-textSecondary'>PICK YOUR ANSWER</Text>

      <View className='gap-3'>
        {answers.map((answer, index) => {
          const id = String(index)
          return (
            <AnswerButton
              key={id}
              answer={answer}
              isSelected={selectedAnswerId === id}
              onPress={() => onSelectAnswer(id)}
            />
          )
        })}
      </View>
    </UiCard>
  )
}

function AnswerButton({
  answer,
  isSelected,
  onPress,
}: {
  answer: string
  isSelected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-lg border px-5 py-4',
        isSelected ? 'border-textPrimary bg-componentPrimary' : 'border-componentPrimary',
      )}
    >
      <Text className='typography-subtitle4 text-center text-textPrimary'>{answer}</Text>
    </Pressable>
  )
}

interface FooterProps {
  selectedAnswerId: string | null
  isLastQuestion: boolean
  canGoBack: boolean
  onPress: () => void
  onBack: () => void
}

function Footer({ onPress, onBack, selectedAnswerId, isLastQuestion, canGoBack }: FooterProps) {
  return (
    <>
      <UiHorizontalDivider />

      <View className='flex-row gap-3'>
        {canGoBack && (
          <UiButton
            variant='outlined'
            title='Previous'
            className='flex-1'
            leadingIconProps={{ customIcon: 'arrowLeftIcon' }}
            onPress={onBack}
          />
        )}

        <UiButton
          title={isLastQuestion ? 'Finish' : 'Next Question'}
          trailingIconProps={{ customIcon: 'arrowRightIcon' }}
          disabled={!selectedAnswerId}
          className='flex-1'
          onPress={onPress}
        />
      </View>
    </>
  )
}
