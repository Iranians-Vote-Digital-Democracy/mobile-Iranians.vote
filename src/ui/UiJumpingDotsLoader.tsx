import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { cn } from '@/theme'

const UiJumpingDotsLoader = ({ size = 10, color = 'textPrimary' }) => {
  const dot1Y = useSharedValue(0)
  const dot2Y = useSharedValue(0)
  const dot3Y = useSharedValue(0)

  useEffect(() => {
    const jumpHeight = -10
    const animationDuration = 400
    const staggerDelay = 150

    const jumpAnimation = withRepeat(
      withSequence(
        withTiming(jumpHeight, {
          duration: animationDuration,
          easing: Easing.out(Easing.ease),
        }),
        withTiming(0, {
          duration: animationDuration,
          easing: Easing.in(Easing.ease),
        }),
      ),
      -1,
    )

    dot1Y.value = withDelay(0, jumpAnimation)
    dot2Y.value = withDelay(staggerDelay, jumpAnimation)
    dot3Y.value = withDelay(staggerDelay * 2, jumpAnimation)
  }, [dot1Y, dot2Y, dot3Y])

  const animatedDot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }))

  const animatedDot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }))

  const animatedDot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }))

  return (
    <View className='flex-row items-center justify-center gap-2'>
      <Animated.View
        className={cn('rounded-full', `bg-${color}`)}
        style={[{ width: size, height: size }, animatedDot1Style]}
      />
      <Animated.View
        className={cn('rounded-full', `bg-${color}`)}
        style={[{ width: size, height: size }, animatedDot2Style]}
      />
      <Animated.View
        className={cn('rounded-full', `bg-${color}`)}
        style={[{ width: size, height: size }, animatedDot3Style]}
      />
    </View>
  )
}

export default UiJumpingDotsLoader
