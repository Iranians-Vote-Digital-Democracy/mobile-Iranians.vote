import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { UiButton, UiCard, UiHorizontalDivider, UiIcon } from '@/ui'

interface Question {
  title: string
  variants: string[]
}
interface QuestionScreenProps {
  questions: Question[]
  currentQuestionIndex: number
  onSubmit: (id: string) => void
  onBack: () => void
  onClose: () => void
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
  const canGoBack = currentQuestionIndex > 0
  const isLast = currentQuestionIndex === questions.length - 1
  const insets = useSafeAreaInsets()

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
        isLastQuestion={isLast}
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
    <UiCard className='w-full justify-center gap-5 p-4'>
      <Text className='typography-h6 text-center text-textPrimary'>{question}</Text>
      <UiHorizontalDivider />
      <Text className='typography-overline2 text-textSecondary'>PICK YOUR ANSWER</Text>

      <View className='mt-3 gap-3'>
        {answers.map((answer, index) => {
          const id = String(index)
          return (
            <UiButton
              key={`${answer}-${index}`}
              color='primary'
              title={answer}
              className='w-full'
              variant='outlined'
              size='medium'
              leadingIconProps={selectedAnswerId === id ? { customIcon: 'checkIcon' } : undefined}
              onPress={() => onSelectAnswer(id)}
            />
          )
        })}
      </View>
    </UiCard>
  )
}

function Footer({
  selectedAnswerId,
  isLastQuestion,
  canGoBack,
  onPress,
  onBack,
}: {
  selectedAnswerId: string | null
  isLastQuestion: boolean
  canGoBack: boolean
  onPress: () => void
  onBack: () => void
}) {
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
