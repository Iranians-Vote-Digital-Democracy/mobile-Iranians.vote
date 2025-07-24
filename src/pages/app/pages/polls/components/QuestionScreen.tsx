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
  selectedAnswerId: string | null
  onSelectAnswer: (id: string) => void
  onSubmit: (id: string) => void
  onBack: () => void
  onClose: () => void
}

export default function QuestionScreen({
  questions,
  selectedAnswerId,
  onSelectAnswer,
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
              const id = String(index)
              return (
                <UiButton
                  key={`${answer}-${index}`}
                  color='primary'
                  title={answer}
                  className='w-full'
                  variant='outlined'
                  size='medium'
                  leadingIconProps={
                    selectedAnswerId === id ? { customIcon: 'checkIcon' } : undefined
                  }
                  onPress={() => onSelectAnswer(id)}
                />
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
            disabled={!selectedAnswerId}
            className='flex-1'
            onPress={() => onSubmit(selectedAnswerId!)}
          />
        </View>
      </>
    </View>
  )
}
